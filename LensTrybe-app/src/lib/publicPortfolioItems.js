/**
 * Load portfolio rows for public profile + /portfolio/:id.
 * Prefer SECURITY DEFINER RPC (works even when RLS blocks direct table reads).
 */
export async function fetchPublicPortfolioItems(supabase, creativeId, { selectColumns } = {}) {
  if (!supabase || !creativeId) {
    return { data: [], error: null, source: 'none', rpcAttemptError: null }
  }

  const columns =
    selectColumns ||
    'id, image_url, media_url, url, created_at, headline, alt_text, title, sort_order'

  const rpc = await supabase.rpc('get_public_portfolio_items', { p_creative_id: creativeId })
  if (!rpc.error && Array.isArray(rpc.data)) {
    return { data: rpc.data, error: null, source: 'rpc', rpcAttemptError: null }
  }

  const tbl = await supabase
    .from('portfolio_items')
    .select(columns)
    .eq('creative_id', creativeId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(120)

  return {
    data: Array.isArray(tbl.data) ? tbl.data : [],
    error: tbl.error,
    source: 'table',
    rpcAttemptError: rpc.error?.message || null,
  }
}
