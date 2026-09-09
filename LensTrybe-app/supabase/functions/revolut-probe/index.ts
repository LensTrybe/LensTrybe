// Disabled. Temporary probe; its work is done.
Deno.serve(() => new Response(JSON.stringify({ disabled: true }), { status: 410, headers: { 'Content-Type': 'application/json' } }))
