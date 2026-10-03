// founding-code: checks a founding invite code before an account exists (Join), and the older
// "redeem" action for a signed-in creative.
//   validate {code}   is the code live, and what does it grant (tier, forever)
//   redeem   {code}   (signed in) use the code on the account you have
//
// 3 Oct 2026: redeem now goes through the redeem_founding_code database function, the same one
// the Founding hub uses, so every path grants exactly what sign-up does (12 months and the badge
// for the first 100, then 6 months; a comped code its own tier) and refuses the same cases
// (not a creative, deleting, already founding, already paying). Before this it always gave 12
// months and the badge, with no cap, no terms record and no account checks.
// The grant at sign-up itself is done by handle_new_user. No JWT check at the gateway, because
// validate runs before anyone is signed in; redeem checks the user's token itself.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

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

    // Redeem on an existing account: the database function does the checks and the grant.
    if (action === "redeem") {
      const authHeader = req.headers.get("Authorization") ?? "";
      const token = authHeader.replace("Bearer ", "");
      if (!token) return json({ valid: false, reason: "not_authenticated" }, 401);
      const { data: userData, error: userErr } = await admin.auth.getUser(token);
      if (userErr || !userData?.user) return json({ valid: false, reason: "not_authenticated" }, 401);

      const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: "Bearer " + token } },
        auth: { persistSession: false },
      });
      const { data: r, error: rErr } = await asUser.rpc("redeem_founding_code", {
        p_code: normalisedCode,
        p_terms_version: typeof body.terms_version === "string" ? body.terms_version.slice(0, 40) : null,
        p_ua: (req.headers.get("user-agent") || "").slice(0, 400),
      });
      if (rErr) {
        console.error("founding-code: redeem failed", rErr.message);
        return json({ valid: false, reason: "claim_error" }, 500);
      }
      if (!r?.ok) {
        const reason = r?.reason === "redeemed" ? "already_redeemed" : (r?.reason || "claim_error");
        return json({ valid: false, reason });
      }
      return json({ valid: true, granted: true, tier: r.tier, months: r.months, badge: r.badge });
    }

    const { data: invite, error } = await admin
      .from("founding_invites")
      .select("status, region, expires_at, grant_tier, grant_forever")
      .eq("code", normalisedCode)
      .maybeSingle();

    if (error) return json({ valid: false, reason: "lookup_error" }, 500);
    if (!invite) return json({ valid: false, reason: "not_found" });
    if (invite.status !== "unused") return json({ valid: false, reason: invite.status });
    // Invites expire 14 days after they're sent (drafts have no expiry yet).
    if (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) {
      return json({ valid: false, reason: "expired" });
    }

    // Just checking a code (user not signed in yet). tier and forever let the signup screen
    // say what the code actually gives; the grant itself is done by handle_new_user.
    if (action === "validate") {
      return json({
        valid: true,
        region: invite.region ?? null,
        tier: invite.grant_tier ?? "expert",
        forever: invite.grant_forever === true,
      });
    }

    return json({ valid: false, reason: "unknown_action" }, 400);
  } catch (_e) {
    return json({ valid: false, reason: "bad_request" }, 400);
  }
});
