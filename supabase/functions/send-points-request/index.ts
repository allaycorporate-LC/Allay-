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

  // Extraer JWT del header Authorization
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

  // Verificar el JWT y obtener el user_id real
  const { data: { user }, error: authError } = await adminClient.auth.getUser(jwt);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Leer perfil desde la base de datos — no confiar en datos del cliente
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('name, email, role, company_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return new Response(JSON.stringify({ error: 'Profile not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Solo admins y superadmins pueden solicitar puntos
  if (profile.role !== 'admin' && profile.role !== 'superadmin') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Leer cantidad de puntos del body (único dato que viene del cliente)
  const body = await req.json().catch(() => ({}));
  const points = Number(body.points);
  if (!points || points < 100 || !Number.isInteger(points)) {
    return new Response(JSON.stringify({ error: 'Invalid points value' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Buscar nombre de la empresa
  const { data: company } = await adminClient
    .from('companies')
    .select('name')
    .eq('id', profile.company_id)
    .maybeSingle();

  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const companyLabel = company?.name || profile.company_id;
  const now = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;background:#f9f9f9;border-radius:12px;">
      <h2 style="color:#7c3aed;margin-bottom:4px;">Nueva solicitud de puntos</h2>
      <p style="color:#6b7280;margin-top:0;font-size:14px;">${now}</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
      <table style="width:100%;font-size:15px;color:#374151;border-collapse:collapse;">
        <tr><td style="padding:8px 0;font-weight:600;width:160px;">Empresa</td><td>${companyLabel}</td></tr>
        <tr><td style="padding:8px 0;font-weight:600;">Company ID</td><td style="font-family:monospace;font-size:13px;">${profile.company_id}</td></tr>
        <tr><td style="padding:8px 0;font-weight:600;">Admin</td><td>${profile.name}</td></tr>
        <tr><td style="padding:8px 0;font-weight:600;">Email admin</td><td>${profile.email}</td></tr>
        <tr><td style="padding:8px 0;font-weight:600;">Puntos solicitados</td><td style="font-size:20px;font-weight:700;color:#7c3aed;">${points.toLocaleString('es-AR')}</td></tr>
      </table>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
      <p style="font-size:13px;color:#9ca3af;margin:0;">Este mail fue generado automáticamente por Allay.</p>
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
      subject: `[Allay] Solicitud de ${points.toLocaleString('es-AR')} puntos — ${companyLabel}`,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return new Response(JSON.stringify({ error: err }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
