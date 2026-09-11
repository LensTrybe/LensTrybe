import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Founding members are free for 12 months from the day they redeem, then billed at their
// locked-in founding rate ($49/mo). Rolling per creative, not a fixed calendar date.
function rollingBillingStart() {
  const d = new Date();
  d.setMonth(d.getMonth() + 12);
  return d.toISOString().slice(0, 10);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const normalisedCode = String(body.code ?? "").trim().toUpperCase();

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (!normalisedCode) return json({ valid: false, reason: "missing_code" }, 400);
    if (normalisedCode.length > 64) return json({ valid: false, reason: "not_found" });

    // Code checks are rate limited per IP so codes can't be brute forced.
    if (action === "validate" || action === "redeem") {
      const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
      const { data: allowed, error: rlErr } = await admin.rpc("rate_limit_hit", {
        p_key: "founding-code:ip:" + ip,
        p_max: 20,
        p_window_seconds: 600,
      });
      if (rlErr) {
        console.error("founding-code: rate limit check failed", rlErr.message);
        return json({ valid: false, reason: "lookup_error" }, 500);
      }
      if (allowed !== true) return json({ valid: false, reason: "rate_limited" }, 429);
    }

    const { data: invite, error } = await admin
      .from("founding_invites")
      .select("status, region, expires_at")
      .eq("code", normalisedCode)
      .maybeSingle();

    if (error) return json({ valid: false, reason: "lookup_error" }, 500);
    if (!invite) return json({ valid: false, reason: "not_found" });
    if (invite.status !== "unused") return json({ valid: false, reason: invite.status });
    // Invites expire 14 days after they're sent (drafts have no expiry yet).
    if (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) {
      return json({ valid: false, reason: "expired" });
    }

    // Just checking a code (user not signed in yet).
    if (action === "validate") {
      return json({ valid: true, region: invite.region ?? null });
    }

    // Redeem after the account exists: claim the code and grant the free year.
    if (action === "redeem") {
      const authHeader = req.headers.get("Authorization") ?? "";
      const token = authHeader.replace("Bearer ", "");
      if (!token) return json({ valid: false, reason: "not_authenticated" }, 401);

      const { data: userData, error: userErr } = await admin.auth.getUser(token);
      if (userErr || !userData?.user) return json({ valid: false, reason: "not_authenticated" }, 401);
      const userId = userData.user.id;

      // Atomic single-use claim: only succeeds if still unused.
      const { data: claimed, error: claimErr } = await admin
        .from("founding_invites")
        .update({ status: "redeemed", redeemed_by: userId, redeemed_at: new Date().toISOString() })
        .eq("code", normalisedCode)
        .eq("status", "unused")
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .select()
        .maybeSingle();

      if (claimErr) return json({ valid: false, reason: "claim_error" }, 500);
      if (!claimed) return json({ valid: false, reason: "already_redeemed" });

      const { error: profErr } = await admin
        .from("profiles")
        .update({
          subscription_tier: "expert",
          subscription_status: "active",
          founding_member: true,
          founding_member_since: new Date().toISOString(),
          show_founding_badge: true,
          next_billing_date: rollingBillingStart(),
        })
        .eq("id", userId);

      if (profErr) {
        // Roll back the claim so a glitch doesn't burn the code.
        await admin
          .from("founding_invites")
          .update({ status: "unused", redeemed_by: null, redeemed_at: null })
          .eq("code", normalisedCode);
        return json({ valid: false, reason: "grant_error" }, 500);
      }

      return json({ valid: true, granted: true });
    }

    return json({ valid: false, reason: "unknown_action" }, 400);
  } catch (_e) {
    return json({ valid: false, reason: "bad_request" }, 400);
  }
});
