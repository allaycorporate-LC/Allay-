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
  const points = Number(body.points);

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
  const MAX_POINTS_REQUEST = 50000;
  if (!points || points < 100 || points > MAX_POINTS_REQUEST || !Number.isInteger(points)) {
    return new Response(JSON.stringify({ error: 'Invalid points value. Must be integer between 100 and 50000.' }), {
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

  // Registrar la solicitud en la base de datos
  const { data: request, error: requestError } = await adminClient
    .from('points_purchase_requests')
    .insert({
      company_id:   profile.company_id,
      requested_by: user.id,
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

  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (resendKey) {
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
      console.log('[send-points-request] Resend error:', await res.text());
    }
  } else {
    console.log('[send-points-request] RESEND_API_KEY not configured, skipping email');
  }

  return new Response(JSON.stringify({ ok: true, request_id: request.id }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
