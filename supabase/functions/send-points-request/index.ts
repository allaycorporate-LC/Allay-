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

  // Leer perfil del caller desde la base de datos
  const { data: callerProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('name, email, role, company_id')
    .eq('id', user.id)
    .single();

  if (profileError || !callerProfile) {
    return new Response(JSON.stringify({ error: 'Profile not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Solo admins y superadmins pueden solicitar puntos
  if (callerProfile.role !== 'admin' && callerProfile.role !== 'superadmin') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Leer cantidad de puntos del body
  const body = await req.json().catch(() => ({}));
  const points  = Number(body.points);
  const message = typeof body.message === 'string' ? body.message.slice(0, 500) : null;

  // Si el superadmin está impersonando un admin, usar el perfil del admin impersonado
  let profile = callerProfile;
  if (callerProfile.role === 'superadmin' && body.impersonated_user_id) {
    const { data: impProfile } = await adminClient
      .from('profiles')
      .select('name, email, role, company_id')
      .eq('id', body.impersonated_user_id)
      .single();
    if (impProfile && (impProfile.role === 'admin' || impProfile.role === 'employee')) {
      profile = impProfile;
    }
  }
  const MAX_POINTS_REQUEST = 500000;
  if (!points || points < 1000 || points > MAX_POINTS_REQUEST || !Number.isInteger(points)) {
    return new Response(JSON.stringify({ error: 'Invalid points value. Must be integer between 1000 and 500000.' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Buscar nombre de la empresa
  const { data: company } = await adminClient
    .from('companies')
    .select('name')
    .eq('id', profile.company_id)
    .maybeSingle();

  const companyLabel = company?.name || profile.company_id;
  const now = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

  // Si el superadmin impersona, la solicitud se registra a nombre del usuario impersonado
  const requestedByUserId = (callerProfile.role === 'superadmin' && body.impersonated_user_id)
    ? body.impersonated_user_id
    : user.id;

  // Registrar la solicitud en la base de datos
  const { data: request, error: requestError } = await adminClient
    .from('points_purchase_requests')
    .insert({
      company_id:   profile.company_id,
      requested_by: requestedByUserId,
      points,
      status:       'pending',
    })
    .select('id')
    .single();

  if (requestError) {
    return new Response(JSON.stringify({ error: requestError.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Notificar a todos los superadmins
  const { data: superadmins } = await adminClient
    .from('profiles')
    .select('id')
    .eq('role', 'superadmin');

  if (superadmins && superadmins.length > 0) {
    await adminClient.from('notifications').insert(superadmins.map((sa) => ({
      user_id: sa.id,
      type:    'points_purchase_request',
      data: {
        request_id:     request.id,
        company_id:     profile.company_id,
        company_name:   companyLabel,
        requester_name: profile.name,
        points,
      },
    })));
  }

  // Billing breakdown (internal only — never shown to the company)
  const PTS_PER_USD = 500;
  const baseUsd     = points / PTS_PER_USD;
  const markupUsd   = baseUsd * 0.20;
  const totalUsd    = baseUsd * 1.20;
  const fmtUsd = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (resendKey) {
    const html = `
      <div style="font-family:sans-serif;max-width:560px;margin:auto;padding:32px;background:#f9f9f9;border-radius:12px;">
        <h2 style="color:#7c3aed;margin-bottom:4px;">💰 Nueva solicitud de puntos</h2>
        <p style="color:#6b7280;margin-top:0;font-size:14px;">${now}</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
        <table style="width:100%;font-size:15px;color:#374151;border-collapse:collapse;">
          <tr><td style="padding:8px 0;font-weight:600;width:160px;">Empresa</td><td>${companyLabel}</td></tr>
          <tr><td style="padding:8px 0;font-weight:600;">Company ID</td><td style="font-family:monospace;font-size:13px;">${profile.company_id}</td></tr>
          <tr><td style="padding:8px 0;font-weight:600;">Admin</td><td>${profile.name}</td></tr>
          <tr><td style="padding:8px 0;font-weight:600;">Email admin</td><td>${profile.email}</td></tr>
          <tr><td style="padding:8px 0;font-weight:600;">Puntos solicitados</td><td style="font-size:20px;font-weight:700;color:#7c3aed;">${points.toLocaleString('es-AR')} pts</td></tr>
        </table>
        ${message ? `
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
          <p style="font-weight:600;color:#374151;margin:0 0 6px;font-size:13px;">💬 Mensaje del admin:</p>
          <p style="color:#374151;font-size:14px;line-height:1.6;margin:0;white-space:pre-wrap;">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
        </div>` : ''}
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
        <p style="font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px;">📊 Facturación interna Allay</p>
        <table style="width:100%;font-size:15px;color:#374151;border-collapse:collapse;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
          <tr style="background:#f5f3ff;">
            <td style="padding:10px 16px;font-weight:600;">Costo base</td>
            <td style="padding:10px 16px;text-align:right;font-family:monospace;">$${fmtUsd(baseUsd)} USD</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;font-weight:600;">Markup Allay (20%)</td>
            <td style="padding:10px 16px;text-align:right;font-family:monospace;">$${fmtUsd(markupUsd)} USD</td>
          </tr>
          <tr style="background:#ede9fe;">
            <td style="padding:12px 16px;font-weight:700;font-size:16px;color:#5b21b6;">Total a facturar</td>
            <td style="padding:12px 16px;text-align:right;font-weight:700;font-size:18px;color:#5b21b6;font-family:monospace;">$${fmtUsd(totalUsd)} USD</td>
          </tr>
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
      console.log('[send-points-request] Resend error:', await res.text());
    }
  } else {
    console.log('[send-points-request] RESEND_API_KEY not configured, skipping email');
  }

  return new Response(JSON.stringify({ ok: true, request_id: request.id }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
