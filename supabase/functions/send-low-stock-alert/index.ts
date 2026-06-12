const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  // Solo el trigger de la base de datos (con el secreto compartido) puede llamar esta función
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token || token !== Deno.env.get('LOW_STOCK_ALERT_SECRET')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const body = await req.json().catch(() => ({}));
  const { reward_id, name, stock } = body;

  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (resendKey) {
    const html = `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;background:#f9f9f9;border-radius:12px;">
        <h2 style="color:#dc2626;margin-bottom:4px;">⚠️ Stock bajo en la Store</h2>
        <p style="color:#6b7280;margin-top:0;font-size:14px;">Un producto se está quedando sin unidades disponibles.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
        <table style="width:100%;font-size:15px;color:#374151;border-collapse:collapse;">
          <tr><td style="padding:8px 0;font-weight:600;width:160px;">Producto</td><td>${name}</td></tr>
          <tr><td style="padding:8px 0;font-weight:600;">Stock restante</td><td style="font-size:20px;font-weight:700;color:#dc2626;">${stock}</td></tr>
          <tr><td style="padding:8px 0;font-weight:600;">Reward ID</td><td style="font-family:monospace;font-size:13px;">${reward_id}</td></tr>
        </table>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
        <p style="font-size:13px;color:#9ca3af;margin:0;">Reponé el stock desde la vista de administración de la Store (rol superadmin).</p>
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
        subject: `[Allay] Stock bajo: ${name} (${stock} ${stock === 1 ? 'unidad' : 'unidades'})`,
        html,
      }),
    });

    if (!res.ok) {
      console.log('[send-low-stock-alert] Resend error:', await res.text());
    }
  } else {
    console.log('[send-low-stock-alert] RESEND_API_KEY not configured, skipping email');
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
