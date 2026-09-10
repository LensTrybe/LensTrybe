// Retired in the September 2026 security pass: this endpoint is no longer used by the app.
Deno.serve(() => new Response(JSON.stringify({ error: 'This endpoint has been retired.' }), { status: 410, headers: { 'Content-Type': 'application/json' } }))
