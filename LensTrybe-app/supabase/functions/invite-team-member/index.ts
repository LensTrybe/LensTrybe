import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { name, email, role, creative_id, team_member_id, acceptUrl, businessName } = await req.json();

    if (!email || !creative_id) {
      return new Response(JSON.stringify({ error: 'Missing email or creative_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Update team member status
    if (team_member_id) {
      await supabaseAdmin
        .from('team_members')
        .update({ invite_status: 'sent', invite_sent_at: new Date().toISOString() })
        .eq('id', team_member_id);
    }

    // Build the accept URL - use passed acceptUrl or fall back to default
    const joinUrl = acceptUrl || `https://lenstrybe.com/dashboard`;
    const studioName = businessName || 'a creative studio';
    const memberName = name || 'there';
    const memberRole = role || 'Member';

    // Send branded invite email with the join link directly in it
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'LensTrybe <noreply@mail.lenstrybe.com>',
        to: email,
        subject: `You've been invited to join ${studioName} on LensTrybe`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #0f0f0f; color: #e8e8e8; border-radius: 16px; overflow: hidden;">
            <div style="background: #141414; padding: 40px 40px 32px; border-bottom: 1px solid #1e1e1e; text-align: center;">
              <div style="font-size: 28px; font-weight: 900; color: #1DB954; letter-spacing: -0.5px;">LensTrybe</div>
              <div style="font-size: 13px; color: #555; margin-top: 4px;">For creatives, by creatives</div>
            </div>
            <div style="padding: 40px;">
              <h1 style="font-size: 24px; font-weight: 800; color: #fff; margin: 0 0 12px;">You've been invited!</h1>
              <p style="font-size: 15px; color: #aaa; line-height: 1.7; margin: 0 0 20px;">
                Hi ${memberName}, <strong style="color:#fff;">${studioName}</strong> has invited you to join their team on LensTrybe as a <strong style="color:#fff;">${memberRole}</strong>.
              </p>
              <div style="text-align: center; margin: 32px 0;">
                <a href="${joinUrl}" style="display: inline-block; background: #1DB954; color: #000; font-weight: 700; font-size: 16px; padding: 14px 36px; border-radius: 10px; text-decoration: none; letter-spacing: -0.2px;">Accept Invitation</a>
              </div>
              <div style="background: #141414; border: 1px solid #1e1e1e; border-radius: 12px; padding: 20px; margin-bottom: 28px;">
                <div style="font-size: 12px; color: #555; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; margin-bottom: 8px;">Invitation details</div>
                <div style="font-size: 14px; color: #e8e8e8;"><strong>Studio:</strong> ${studioName}</div>
                <div style="font-size: 14px; color: #e8e8e8; margin-top: 6px;"><strong>Role:</strong> ${memberRole}</div>
                <div style="font-size: 14px; color: #e8e8e8; margin-top: 6px;"><strong>Email:</strong> ${email}</div>
              </div>
              <p style="font-size: 13px; color: #555; line-height: 1.6; margin: 0 0 8px;">Or copy and paste this link into your browser:</p>
              <p style="font-size: 12px; color: #1DB954; word-break: break-all; margin: 0 0 20px;">${joinUrl}</p>
              <p style="font-size: 13px; color: #555; line-height: 1.6; margin: 0;">If you weren't expecting this invitation, you can safely ignore this email.</p>
            </div>
            <div style="background: #141414; padding: 20px 40px; border-top: 1px solid #1e1e1e; text-align: center;">
              <div style="font-size: 12px; color: #444;">LensTrybe &bull; <a href="https://lenstrybe.com" style="color: #1DB954; text-decoration: none;">lenstrybe.com</a></div>
            </div>
          </div>
        `,
      }),
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
