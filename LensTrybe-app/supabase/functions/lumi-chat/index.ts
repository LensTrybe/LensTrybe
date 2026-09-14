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
  elite: { monthly: 500, daily: 50 },
};

// Where the creative is standing when they ask. Without this Lumi answers "how do I send
// an invoice" with generic advice while they are looking at the invoicing screen.
// The widget sends the path; matching it here against a fixed list means the client
// cannot put arbitrary text into the system prompt.
const PAGE_LABELS: [string, string][] = [
  ["/dashboard/finance/invoicing", "Invoicing, where they create and send invoices"],
  ["/dashboard/finance/quotes", "Quotes, where they create and send quotes"],
  ["/dashboard/finance/contracts", "Contracts, where they write and send contracts for e-signature"],
  ["/dashboard/finance/expenses", "Expenses, where they log business expenses"],
  ["/dashboard/finance/tax", "the Tax hub"],
  ["/dashboard/finance/overview", "Finance overview, their income and expenses at a glance"],
  ["/dashboard/clients/messages", "Messages, their client conversations"],
  ["/dashboard/clients/meetings", "Meetings, where they schedule calls with clients"],
  ["/dashboard/clients/contacts", "Contacts, their client list"],
  ["/dashboard/clients/crm", "the CRM, their client pipeline"],
  ["/dashboard/portfolio-design/brand-kit", "the Brand kit, which sets the colours, fonts and logo on their documents"],
  ["/dashboard/portfolio-design/deliver", "Deliver, where they send photo and video galleries to clients"],
  ["/dashboard/portfolio-design/portfolio-website", "the Website builder, their public portfolio site"],
  ["/dashboard/my-work/my-bookings", "Bookings, their confirmed and pending jobs"],
  ["/dashboard/my-work/availability", "their Availability calendar"],
  ["/dashboard/my-work/jobs", "the Job board, where they find work posted by others"],
  ["/dashboard/profile/edit-profile", "Edit profile, where they fill in what clients see in search"],
  ["/dashboard/profile/view-profile", "their public profile as a client sees it"],
  ["/dashboard/business/reviews", "Reviews from their clients"],
  ["/dashboard/business/marketplace", "the Marketplace, buying and selling second hand gear"],
  ["/dashboard/business/team", "Team, where they invite people to their account"],
  ["/dashboard/settings/subscription", "Subscription settings, their plan and payment card"],
  ["/dashboard/projects", "Projects, where they track a job from enquiry to delivery"],
  ["/dashboard/inventory", "Inventory, their gear list"],
  ["/dashboard/content/calendar", "their Content calendar for social posts"],
  ["/dashboard/content/ideas", "Content ideas"],
  ["/dashboard/collaborate", "Collaborate, finding other creatives to work with"],
  ["/dashboard/founding", "the Founding Hub, where they track their founding creative commitments"],
  ["/dashboard/notes", "Notes"],
  ["/dashboard/referrals", "Referrals"],
  ["/dashboard/settings", "Settings"],
  ["/dashboard/support", "Support"],
];

function pageLabel(path: unknown): string | null {
  const p = typeof path === "string" ? path : "";
  let best: [string, string] | null = null;
  for (const row of PAGE_LABELS) {
    if (p.startsWith(row[0]) && (!best || row[0].length > best[0].length)) best = row;
  }
  if (best) return best[1];
  if (p === "/dashboard" || p === "/dashboard/") return "their dashboard home, the overview screen";
  return null;
}


// ---- What Lumi is allowed to look up ----
//
// Every one of these reads ONLY the signed in creative's own rows. The user id comes from
// their verified JWT and is applied server side on every query: the model never supplies
// it and cannot ask for anyone else's data. All read only. Nothing here writes.

const TOOLS = [
  {
    name: "get_money_owed",
    description: "Invoices this creative has sent that are not paid yet, soonest due first. Use when asked about outstanding money, who owes them, overdue invoices, or cash coming in.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_upcoming_bookings",
    description: "Confirmed and pending bookings from today onwards, soonest first. Use when asked what is coming up, how busy they are, or about a specific upcoming job.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_enquiries_needing_a_reply",
    description: "Client conversations where the client sent the last message and the creative has not replied. Use when asked what needs attention, who is waiting, or about unanswered enquiries.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_recent_quotes",
    description: "Quotes sent recently and their status (sent, accepted, declined). Use when asked about quotes out for approval, conversion, or what a particular client was quoted.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_clients",
    description: "The creative's saved contacts: name, email, phone, company and any notes they wrote. Use when asked about a specific client by name, or about their client base.",
    input_schema: {
      type: "object",
      properties: { search: { type: "string", description: "Optional name or email fragment to filter by." } },
      required: [],
    },
  },
  {
    name: "get_business_snapshot",
    description: "Headline numbers: how much is owed, how many bookings are coming up, how many enquiries are waiting, how many clients. Use for a general 'how am I doing' question before deciding whether to look deeper.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
];

// Invoice statuses that still represent money out there. draft is not sent yet, paid is done.
const UNPAID_STATUSES = ["sent", "viewed", "overdue"];
// A cancelled or declined booking is not work they still have on.
const LIVE_BOOKING_STATUSES = ["pending", "confirmed", "completed"];

const money = (v: unknown) => "$" + (Number(v) || 0).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (v: unknown) => (v ? String(v).slice(0, 10) : null);

/**
 * Threads where the client spoke last, so the creative still owes a reply.
 *
 * message_threads does not carry the last sender, so work it out from the messages
 * themselves: newest message per thread, kept if a client sent it. Older messages have no
 * sender_type at all, and those came from clients, hence the null check.
 */
// deno-lint-ignore no-explicit-any
async function threadsAwaitingReply(supabase: any, userId: string) {
  const { data: msgs } = await supabase.from("messages")
    .select("thread_id, sender_type, created_at, body")
    .eq("creative_id", userId)
    .order("created_at", { ascending: false })
    .limit(400);

  const newest = new Map<string, any>();
  for (const m of msgs || []) {
    if (!m.thread_id || newest.has(m.thread_id)) continue;
    newest.set(m.thread_id, m);
  }
  const waiting = [...newest.entries()].filter(([, m]) => !m.sender_type || m.sender_type === "client");
  if (!waiting.length) return [];

  const { data: threads } = await supabase.from("message_threads")
    .select("id, client_name, client_email, subject")
    .eq("creative_id", userId)
    .in("id", waiting.map(([id]) => id));

  const byId = new Map((threads || []).map((t: any) => [t.id, t]));
  return waiting
    .map(([id, m]) => {
      const t = byId.get(id);
      if (!t) return null;
      return {
        client: t.client_name, email: t.client_email, subject: t.subject,
        last_heard: day(m.created_at),
        days_waiting: Math.floor((Date.now() - new Date(m.created_at).getTime()) / 86400000),
        their_last_message: String(m.body || "").slice(0, 400),
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => b.days_waiting - a.days_waiting);
}

// deno-lint-ignore no-explicit-any
async function runTool(supabase: any, userId: string, name: string, input: any) {
  const cap = 25;
  switch (name) {
    case "get_money_owed": {
      const { data } = await supabase.from("invoices")
        .select("client_name, client_email, amount, due_date, status, created_at")
        .eq("creative_id", userId).in("status", UNPAID_STATUSES)
        .order("due_date", { ascending: true }).limit(cap);
      const rows = (data || []).map((r: any) => ({
        client: r.client_name, amount: money(r.amount), due: day(r.due_date),
        status: r.status, overdue: r.due_date ? new Date(r.due_date) < new Date() : false,
      }));
      const total = (data || []).reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
      return { count: rows.length, total_owed: money(total), invoices: rows };
    }
    case "get_upcoming_bookings": {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase.from("bookings")
        .select("client_name, service, booking_date, start_time, location, status")
        .eq("creative_id", userId).gte("booking_date", today).in("status", LIVE_BOOKING_STATUSES)
        .order("booking_date", { ascending: true }).limit(cap);
      return { count: (data || []).length, bookings: (data || []).map((r: any) => ({
        client: r.client_name, service: r.service, date: day(r.booking_date),
        time: r.start_time, location: r.location, status: r.status,
      })) };
    }
    case "get_enquiries_needing_a_reply": {
      const waiting = await threadsAwaitingReply(supabase, userId);
      return { count: waiting.length, waiting: waiting.slice(0, cap) };
    }
    case "get_recent_quotes": {
      const { data } = await supabase.from("quotes")
        .select("client_name, amount, status, created_at, valid_until")
        .eq("creative_id", userId).order("created_at", { ascending: false }).limit(cap);
      return { count: (data || []).length, quotes: (data || []).map((r: any) => ({
        client: r.client_name, amount: money(r.amount), status: r.status,
        sent: day(r.created_at), valid_until: day(r.valid_until),
      })) };
    }
    case "get_clients": {
      // The client list lives in contacts, which is what the Contacts screen shows.
      let q = supabase.from("contacts")
        .select("name, email, phone, company, notes, created_at")
        .eq("creative_id", userId);
      const search = typeof input?.search === "string" ? input.search.trim() : "";
      // Escape the LIKE wildcards so a search for "50%" cannot match everything.
      if (search) {
        const safe = search.replace(/[\\%_]/g, (m: string) => "\\" + m);
        q = q.or(`name.ilike.%${safe}%,email.ilike.%${safe}%,company.ilike.%${safe}%`);
      }
      const { data } = await q.order("created_at", { ascending: false }).limit(cap);
      return { count: (data || []).length, clients: (data || []).map((r: any) => ({
        name: r.name, email: r.email, phone: r.phone, company: r.company,
        notes: r.notes, added: day(r.created_at),
      })) };
    }
    case "get_business_snapshot": {
      const today = new Date().toISOString().slice(0, 10);
      const [owed, bookings, waiting, clients] = await Promise.all([
        supabase.from("invoices").select("amount").eq("creative_id", userId).in("status", UNPAID_STATUSES),
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("creative_id", userId).gte("booking_date", today).in("status", LIVE_BOOKING_STATUSES),
        threadsAwaitingReply(supabase, userId),
        supabase.from("contacts").select("id", { count: "exact", head: true }).eq("creative_id", userId),
      ]);
      const total = (owed.data || []).reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
      return {
        money_owed: money(total), unpaid_invoices: (owed.data || []).length,
        upcoming_bookings: bookings.count ?? 0, enquiries_waiting: (waiting as any[]).length,
        total_clients: clients.count ?? 0,
      };
    }
    default:
      return { error: "unknown tool" };
  }
}

const MODEL_BY_TIER: Record<string, string> = {
  pro: "claude-haiku-4-5-20251001",
  expert: "claude-sonnet-4-5-20250929",
  elite: "claude-sonnet-4-5-20250929",
};
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
// Sonnet can say more without rambling, and a truncated answer is worse than a short one.
const MAX_TOKENS_BY_TIER: Record<string, number> = { pro: 1024, expert: 2048, elite: 2048 };

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
    const whereTheyAre = pageLabel(body?.page);

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

You provide practical advice on pricing, client management, quotes, invoices, contracts, portfolio presentation, marketing, and growing a creative business in Australia. Be warm, direct, and specific. Use Australian English. Keep responses concise and actionable.

Never use a dash of any kind as punctuation between clauses, neither the long one nor the short one. Use a comma, a colon, or start a new sentence. This is a firm LensTrybe brand rule and it applies to anything you write, including drafts meant for a client.

You can look up this creative's own LensTrybe data using your tools: money owed, upcoming bookings, enquiries waiting on a reply, recent quotes, their client list, and a snapshot of the business. Use a tool whenever the answer depends on their actual numbers rather than general advice, and answer from what comes back instead of guessing or asking them to check a page themselves. You only ever see this one creative's data. If a tool comes back empty, say so plainly rather than inventing figures. All money is Australian dollars.

When they ask you to write something for a client, a reply to an enquiry, a follow up on an unpaid invoice, a quote description, write the actual words they can copy, in their voice, not a description of what to write. Look up the real names and amounts first so the draft is specific.

Drafts sound like a working creative, not a customer service desk. Short sentences. At most one exclamation mark in a whole message, and usually none. Never open with a pleasantry like hope this finds you well or thanks for reaching out, get to the point. Avoid filler like just, simply, feel free to, and do not close by telling them to tweak it. Sign off with their business name.
${whereTheyAre ? `\nRight now they are looking at ${whereTheyAre}. If their question relates to that screen, answer about it specifically and refer to what is in front of them rather than giving general advice. If they ask about something else entirely, just answer that instead and do not mention the screen.` : ""}`;

    // Tool use loop. The model may ask for data, we run the lookup against this user's own
    // rows only, hand the result back, and let it answer. Capped so a confused model cannot
    // spin: in practice one or two rounds is plenty.
    const model = MODEL_BY_TIER[tier] || DEFAULT_MODEL;
    const maxTokens = MAX_TOKENS_BY_TIER[tier] || 1024;
    const apiMessages: any[] = messagesForApi.map((m) => ({ role: m.role, content: m.content }));

    let aiData = null;
    for (let round = 0; round < 4; round++) {
      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": Deno.env.get("ANTHROPIC_API_KEY"),
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system: systemPrompt,
          tools: TOOLS,
          messages: apiMessages,
        }),
      });

      if (!anthropicRes.ok) {
        const err = await anthropicRes.text();
        // Not the user's fault: give the message back.
        await supabase.rpc("lumi_release", { p_user: user.id });
        throw new Error(`Anthropic error: ${err}`);
      }

      aiData = await anthropicRes.json();
      const blocks = Array.isArray(aiData?.content) ? aiData.content : [];
      const toolUses = blocks.filter((b) => b?.type === "tool_use");
      if (aiData?.stop_reason !== "tool_use" || toolUses.length === 0) break;

      apiMessages.push({ role: "assistant", content: blocks });

      const results = [];
      for (const call of toolUses) {
        let payload;
        try {
          payload = await runTool(supabase, user.id, call.name, call.input || {});
        } catch (e) {
          console.error("lumi tool failed:", call?.name, e);
          payload = { error: "That lookup did not work just now." };
        }
        results.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: JSON.stringify(payload),
        });
      }
      apiMessages.push({ role: "user", content: results });
    }

    const replyText = (Array.isArray(aiData?.content) ? aiData.content : [])
      .filter((b) => b?.type === "text" && typeof b.text === "string")
      .map((b) => b.text)
      .join("\n")
      .trim();

    const assistantMessage = {
      role: "assistant",
      content: replyText || "Sorry, I could not generate a response.",
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
