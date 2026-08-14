import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace('Bearer ', '').trim();
  if (!jwt) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: { user }, error: authError } = await adminClient.auth.getUser(jwt);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: profile } = await adminClient
    .from('profiles')
    .select('name, email, role, company_id')
    .eq('id', user.id)
    .maybeSingle();

  const body = await req.json().catch(() => ({}));
  const { subject, message } = body;

  if (!message) {
    return new Response(JSON.stringify({ error: 'message required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userName    = profile?.name  || 'Usuario desconocido';
  const userEmail   = profile?.email || user.email || '—';
  const userRole    = profile?.role  || '—';
  const companyId   = profile?.company_id || '—';
  const subjectLine = subject || 'Consulta general';

  // Fetch company name if we have a company_id
  let companyName = companyId;
  if (profile?.company_id) {
    const { data: company } = await adminClient
      .from('companies')
      .select('name')
      .eq('id', profile.company_id)
      .maybeSingle();
    if (company?.name) companyName = company.name;
  }

  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) {
    console.log('[send-support-request] RESEND_API_KEY not configured');
    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:auto;padding:32px;background:#f9f9f9;border-radius:12px;">
      <h2 style="color:#3d2b56;margin-bottom:4px;">💬 Nueva consulta o sugerencia</h2>
      <p style="color:#6b7280;margin-top:0;font-size:14px;">Un usuario envió un mensaje desde el menú de ayuda de Allay.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
      <table style="width:100%;font-size:15px;color:#374151;border-collapse:collapse;">
        <tr><td style="padding:8px 0;font-weight:600;width:160px;">Usuario</td><td>${userName}</td></tr>
        <tr><td style="padding:8px 0;font-weight:600;">Email</td><td><a href="mailto:${userEmail}" style="color:#7c3aed;">${userEmail}</a></td></tr>
        <tr><td style="padding:8px 0;font-weight:600;">Empresa</td><td>${companyName}</td></tr>
        <tr><td style="padding:8px 0;font-weight:600;">Rol</td><td>${userRole}</td></tr>
        <tr><td style="padding:8px 0;font-weight:600;">Asunto</td><td>${subjectLine}</td></tr>
      </table>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
      <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:20px;">
        <p style="font-weight:600;color:#374151;margin:0 0 12px;">Mensaje:</p>
        <p style="color:#374151;line-height:1.7;margin:0;white-space:pre-wrap;">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
      </div>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
      <p style="font-size:13px;color:#9ca3af;margin:0;">Enviado desde el panel de ayuda de Allay · ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}</p>
    </div>
  `;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Allay <onboarding@resend.dev>',
      to: ['allay.corporate@gmail.com'],
      reply_to: userEmail !== '—' ? userEmail : undefined,
      subject: `[Allay] ${subjectLine} — ${userName}`,
      html,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.log('[send-support-request] Resend error:', errText);
    return new Response(JSON.stringify({ error: 'email_failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
