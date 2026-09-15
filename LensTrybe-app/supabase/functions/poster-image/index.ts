// Supabase Edge Function: poster-image
//
// Serves a profile poster's image to whoever is looking at that creative's public
// profile, and to nobody else.
//
// Why this exists. The posters bucket used to be public, which meant an uploaded file
// sat at a stable, permanent, guessable-if-leaked lenstrybe.com URL from the instant it
// was uploaded. profile_poster_public applies a careful set of rules before a client is
// shown a poster: it has to be switched on, the creative has to be on Expert or Elite,
// and today has to fall inside the poster's dates. None of those rules touched the
// image. A creative on the free plan could upload anything, never enable a poster, and
// still walk away with a permanent public URL on our domain. Switching a poster off, or
// deleting it, did not take the file down either.
//
// So the bucket is private now and this is the only way in. It asks the same function
// the client-facing poster asks, and only if that returns a live poster does it sign a
// short-lived URL and redirect to it. The image is reachable exactly as long as the
// poster is.
//
// Called straight from an <img src>, so there is no Authorization header and
// verify_jwt has to be false. It takes a creative id, which is already public, and
// returns nothing that is not already on the page.
//
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const BUCKET = 'posters'
const SIGNED_FOR_SECONDS = 3600

// A 1x1 transparent GIF. Sent instead of a 404 so a profile whose poster has just been
// switched off shows nothing rather than a broken image icon.
const BLANK = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), c => c.charCodeAt(0))

function blank(reason: string) {
  return new Response(BLANK, {
    status: 200,
    headers: {
      ...cors,
      'Content-Type': 'image/gif',
      // Short, so a poster that goes live is visible quickly rather than after an hour
      // of some proxy holding on to the blank.
      'Cache-Control': 'public, max-age=60',
      'X-Poster': reason,
    },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: cors })

  try {
    const url = new URL(req.url)
    const creative = (url.searchParams.get('creative') || '').trim()
    if (!UUID_RE.test(creative)) return blank('bad-id')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // The same gate the client-facing poster goes through. Enabled, right tier, inside
    // the date window. Anything else and there is no image to serve.
    const { data: rows, error: rpcError } = await supabase
      .rpc('profile_poster_public', { p_creative: creative })

    if (rpcError) {
      console.error('poster-image: rpc failed', rpcError.message)
      return blank('rpc-error')
    }

    const poster = Array.isArray(rows) ? rows[0] : rows
    const path = poster?.image_path
    if (!path || typeof path !== 'string') return blank('no-image')

    // The path comes out of the poster row, which only its owner can write, and the
    // storage policies already confine writes to that owner's own folder. Refuse
    // anything that tries to climb out of the bucket regardless.
    if (path.includes('..') || path.startsWith('/')) {
      console.error('poster-image: suspicious path for', creative)
      return blank('bad-path')
    }

    const { data: signed, error: signError } = await supabase
      .storage.from(BUCKET).createSignedUrl(path, SIGNED_FOR_SECONDS)

    if (signError || !signed?.signedUrl) {
      console.error('poster-image: sign failed', signError?.message)
      return blank('sign-failed')
    }

    return new Response(null, {
      status: 302,
      headers: {
        ...cors,
        Location: signed.signedUrl,
        // Private and short. The redirect points at a URL that expires, so letting a
        // shared cache keep it would hand out links that stop working.
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch (e) {
    console.error('poster-image: unexpected', e instanceof Error ? e.message : String(e))
    return blank('error')
  }
})
