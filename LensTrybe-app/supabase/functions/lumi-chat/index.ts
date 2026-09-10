import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// monthly -1 = unlimited. Quotas are enforced atomically in the DB (lumi_consume).
const TIER_LIMITS = {
  basic: { monthly: 0, daily: 0 },
  pro: { monthly: 5, daily: 3 },
  expert: { monthly: 100, daily: 25 },
  elite: { monthly: -1, daily: 50 },
};

const MAX_MESSAGE_CHARS = 4000;
const MAX_HISTORY_TURNS = 20;
const MAX_HISTORY_MSG_CHARS = 8000;

// Last N turns only, well-formed for the Anthropic API (string content, starts with a user turn).
function historyForApi(messages) {
  const clean = (Array.isArray(messages) ? messages : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_HISTORY_MSG_CHARS) }))
    .slice(-MAX_HISTORY_TURNS);
  while (clean.length && clean[0].role !== "user") clean.shift();
  // Merge any back-to-back turns from the same role (the API requires alternation).
  const out = [];
  for (const m of clean) {
    if (out.length && out[out.length - 1].role === m.role) out[out.length - 1].content += "\n\n" + m.content;
    else out.push({ ...m });
  }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorised" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorised" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { conversationId, action, title, pinned } = body || {};
    const message = typeof body?.message === "string" ? body.message.trim() : "";

    if (action === "load_conversations") {
      const { data: convos, error } = await supabase
        .from("lumi_conversations")
        .select("id, title, updated_at, messages, pinned")
        .eq("user_id", user.id)
        .order("pinned", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return new Response(JSON.stringify({ conversations: convos || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_conversation") {
      const { error } = await supabase
        .from("lumi_conversations")
        .delete()
        .eq("id", conversationId)
        .eq("user_id", user.id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "rename_conversation") {
      const { error } = await supabase
        .from("lumi_conversations")
        .update({ title: String(title || "Untitled").slice(0, 120) })
        .eq("id", conversationId)
        .eq("user_id", user.id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "pin_conversation") {
      const { error } = await supabase
        .from("lumi_conversations")
        .update({ pinned: pinned === true })
        .eq("id", conversationId)
        .eq("user_id", user.id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "new_conversation") {
      const { data: convo, error } = await supabase
        .from("lumi_conversations")
        .insert({ user_id: user.id, title: "New conversation", messages: [], pinned: false })
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ conversation: convo }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!message) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      return new Response(JSON.stringify({ error: "message_too_long", limit: MAX_MESSAGE_CHARS }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_tier, business_name, tagline, skill_types")
      .eq("id", user.id)
      .single();

    const tier = (profile?.subscription_tier || "basic").toLowerCase();
    const limits = TIER_LIMITS[tier] || TIER_LIMITS.basic;

    if (limits.monthly === 0) {
      return new Response(
        JSON.stringify({ error: "tier_locked", tier }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Atomically check and consume one message against the tier's quota.
    const { data: allowed, error: quotaErr } = await supabase.rpc("lumi_consume", {
      p_user: user.id,
      p_month_limit: limits.monthly,
      p_day_limit: limits.daily,
    });
    if (quotaErr) throw new Error(`quota check failed: ${quotaErr.message}`);

    const readUsage = async () => {
      const { data } = await supabase
        .from("lumi_usage")
        .select("monthly_count, daily_count")
        .eq("user_id", user.id)
        .maybeSingle();
      return { monthly: Number(data?.monthly_count || 0), daily: Number(data?.daily_count || 0) };
    };

    if (allowed !== true) {
      const used = await readUsage();
      const monthlyHit = limits.monthly !== -1 && used.monthly >= limits.monthly;
      return new Response(
        JSON.stringify(monthlyHit
          ? { error: "monthly_limit_reached", limit: limits.monthly }
          : { error: "daily_limit_reached", limit: limits.daily }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let convoId = conversationId;
    let existingMessages = [];

    if (convoId) {
      const { data: convo } = await supabase
        .from("lumi_conversations")
        .select("messages")
        .eq("id", convoId)
        .eq("user_id", user.id)
        .single();
      if (convo) existingMessages = convo.messages || [];
    } else {
      const { data: newConvo } = await supabase
        .from("lumi_conversations")
        .insert({ user_id: user.id, title: "New conversation", messages: [], pinned: false })
        .select()
        .single();
      convoId = newConvo?.id;
    }

    const userMessage = { role: "user", content: message };
    const messagesForApi = historyForApi([...existingMessages, userMessage]);

    const systemPrompt = `You are Lumi, a friendly and knowledgeable AI business assistant built into LensTrybe - a premium no-commission marketplace for Australian visual creatives. You help photographers, videographers, drone pilots, video editors, photo editors, social media managers, hair and makeup artists, and UGC creators grow their businesses.

The user's business is ${profile?.business_name || "their creative business"} and their creative category is ${profile?.skill_types || "visual creative"}.

You provide practical advice on pricing, client management, quotes, invoices, contracts, portfolio presentation, marketing, and growing a creative business in Australia. Be warm, direct, and specific. Use Australian English. Keep responses concise and actionable. Never use em dashes.`;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY"),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: systemPrompt,
        messages: messagesForApi,
      }),
    });

    if (!anthropicRes.ok) {
      const err = await anthropicRes.text();
      // Not the user's fault: give the message back.
      await supabase.rpc("lumi_release", { p_user: user.id });
      throw new Error(`Anthropic error: ${err}`);
    }

    const aiData = await anthropicRes.json();
    const assistantMessage = {
      role: "assistant",
      content: aiData.content?.[0]?.text || "Sorry, I could not generate a response.",
    };

    // Keep the stored conversation bounded.
    const updatedMessages = [...(Array.isArray(existingMessages) ? existingMessages : []), userMessage, assistantMessage].slice(-200);

    let autoTitle = "New conversation";
    if (existingMessages.length === 0) {
      autoTitle = message.length > 60 ? message.substring(0, 57) + "..." : message;
    }

    const updatePayload = { messages: updatedMessages };
    if (existingMessages.length === 0) updatePayload.title = autoTitle;

    await supabase
      .from("lumi_conversations")
      .update(updatePayload)
      .eq("id", convoId)
      .eq("user_id", user.id);

    const used = await readUsage();

    return new Response(
      JSON.stringify({
        reply: assistantMessage.content,
        conversationId: convoId,
        title: existingMessages.length === 0 ? autoTitle : undefined,
        usage: {
          monthly: limits.monthly === -1 ? null : used.monthly,
          monthly_limit: limits.monthly === -1 ? null : limits.monthly,
          daily: used.daily,
          daily_limit: limits.daily,
          tier,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("lumi-chat error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
