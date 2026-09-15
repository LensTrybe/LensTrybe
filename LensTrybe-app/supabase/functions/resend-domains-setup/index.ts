import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Retired one-off helper. Domains registered and verified. No longer active.
Deno.serve(() => new Response(JSON.stringify({ error: "gone" }), { status: 410, headers: { "Content-Type": "application/json" } }));
