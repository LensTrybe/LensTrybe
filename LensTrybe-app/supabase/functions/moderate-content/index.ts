import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Explicit/offensive word list - blocked instantly
const BLOCKED_WORDS = [
  // Swear words
  'fuck', 'shit', 'cunt', 'cock', 'dick', 'pussy', 'asshole', 'bastard', 'bitch', 'wank', 'wanker', 'arse',
  // Racial slurs
  'nigger', 'nigga', 'chink', 'spic', 'kike', 'wetback', 'gook', 'coon', 'spook', 'raghead', 'towelhead',
  // Homophobic slurs
  'faggot', 'fag', 'dyke', 'tranny',
  // Other hate speech
  'retard', 'retarded', 'nazi', 'jihad',
];

// Words that get flagged for admin review (borderline)
const REVIEW_WORDS = [
  'nude', 'naked', 'explicit', 'adult', 'erotic', 'fetish', 'escort', 'hooker', 'prostitute', 'sex worker',
  'porn', 'pornographic', 'xxx', 'nsfw', 'onlyfans',
];

function checkText(text: string): { blocked: boolean; flagged: boolean; reason: string | null } {
  const lower = text.toLowerCase();
  const alnumOnly = lower.replace(/[^a-z0-9]/g, '');

  for (const word of BLOCKED_WORDS) {
    const wordClean = word.replace(/[^a-z0-9]/g, '');
    if (lower.includes(word) || alnumOnly.includes(wordClean)) {
      return { blocked: true, flagged: false, reason: `Contains prohibited language` };
    }
  }

  for (const word of REVIEW_WORDS) {
    if (lower.includes(word)) {
      return { blocked: false, flagged: true, reason: `Contains content requiring review: "${word}"` };
    }
  }

  return { blocked: false, flagged: false, reason: null };
}

async function checkImage(base64Image: string, mimeType: string): Promise<{ blocked: boolean; reason: string | null }> {
  const apiKey = Deno.env.get('GOOGLE_VISION_API_KEY');
  if (!apiKey) {
    console.error('GOOGLE_VISION_API_KEY not set');
    return { blocked: false, reason: null };
  }

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          image: { content: base64Image },
          features: [{ type: 'SAFE_SEARCH_DETECTION' }],
        }],
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    console.error('Vision API error:', err);
    return { blocked: false, reason: null };
  }

  const data = await response.json();
  const safeSearch = data.responses?.[0]?.safeSearchAnnotation;

  if (!safeSearch) return { blocked: false, reason: null };

  // Block if adult or violence is LIKELY or VERY_LIKELY
  const blockLevels = ['LIKELY', 'VERY_LIKELY'];
  
  if (blockLevels.includes(safeSearch.adult)) {
    return { blocked: true, reason: 'Image contains explicit or adult content' };
  }
  if (blockLevels.includes(safeSearch.violence)) {
    return { blocked: true, reason: 'Image contains violent content' };
  }
  if (blockLevels.includes(safeSearch.racy)) {
    return { blocked: true, reason: 'Image contains inappropriate content' };
  }

  return { blocked: false, reason: null };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorised' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorised' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { type, text, imageBase64, mimeType } = body;

    if (type === 'text') {
      if (!text) {
        return new Response(JSON.stringify({ error: 'Text is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const result = checkText(text);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (type === 'image') {
      if (!imageBase64 || !mimeType) {
        return new Response(JSON.stringify({ error: 'Image and mimeType are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const result = await checkImage(imageBase64, mimeType);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid type. Use text or image' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('moderate-content error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
