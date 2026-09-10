// Retired: legacy Stripe / test endpoint. Billing now runs through Revolut (create-revolut-order,
// change-subscription, cancel-revolut-subscription, revolut-webhook, revolut-charge-due).
Deno.serve(() => new Response(JSON.stringify({ error: 'This endpoint has been retired.' }), { status: 410, headers: { 'Content-Type': 'application/json' } }))
