Deno.serve(() => new Response(JSON.stringify({ error: 'This endpoint has been retired.' }), { status: 410, headers: { 'Content-Type': 'application/json' } }))
