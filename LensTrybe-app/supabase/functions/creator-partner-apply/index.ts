import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { name, email, platform, handle, following_size, why } = await req.json();

    if (!name || !email || !platform || !handle || !following_size || !why) {
      return new Response(JSON.stringify({ error: 'All fields are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error: dbError } = await supabase
      .from('creator_partner_applications')
      .insert({ name, email, platform, handle, following_size, why });

    if (dbError) throw dbError;

    // Confirmation email to applicant
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'LensTrybe <connect@lenstrybe.com>',
        to: email,
        subject: 'We received your Creator Partner application!',
        html: `
          <div style="font-family: 'Inter', Arial, sans-serif; background: #12111a; color: #ffffff; max-width: 560px; margin: 0 auto; padding: 48px 32px; border-radius: 12px;">
            <div style="margin-bottom: 32px;">
              <span style="font-size: 20px; font-weight: 700; color: #ffffff;">LensTrybe</span>
            </div>
            <h1 style="font-size: 26px; font-weight: 700; color: #FF2D78; margin: 0 0 16px;">Application received!</h1>
            <p style="font-size: 15px; color: #8b8a9a; line-height: 1.7; margin: 0 0 24px;">
              Hey ${name}, thanks for applying to the LensTrybe Creator Partner Program. We've received your application and we'll be in touch within a few days.
            </p>
            <p style="font-size: 15px; color: #8b8a9a; line-height: 1.7; margin: 0 0 32px;">
              In the meantime, feel free to reply to this email if you have any questions.
            </p>
            <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 24px;">
              <p style="font-size: 12px; color: rgba(255,255,255,0.3); margin: 0;">Connect. Capture. Create. &nbsp;&middot;&nbsp; <a href="mailto:connect@lenstrybe.com" style="color: rgba(255,255,255,0.3);">connect@lenstrybe.com</a></p>
            </div>
          </div>
        `,
      }),
    });

    // Notification to connect@lenstrybe.com
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'LensTrybe <connect@lenstrybe.com>',
        to: 'connect@lenstrybe.com',
        subject: `New Creator Partner application: ${name}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 24px;">
            <h2 style="margin: 0 0 16px;">New Creator Partner Application</h2>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Platform:</strong> ${platform}</p>
            <p><strong>Handle:</strong> ${handle}</p>
            <p><strong>Following size:</strong> ${following_size}</p>
            <p><strong>Why they want to partner:</strong></p>
            <p style="background: #f5f5f5; padding: 12px; border-radius: 6px;">${why}</p>
            <p style="font-size: 12px; color: #888;">Submitted at ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' })} AEST</p>
          </div>
        `,
      }),
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: 'Something went wrong' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
