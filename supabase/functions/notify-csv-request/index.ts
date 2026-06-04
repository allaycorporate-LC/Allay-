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

  try {
    const { request_id } = await req.json();

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: csvReq, error: reqErr } = await admin
      .from('csv_requests')
      .select('*')
      .eq('id', request_id)
      .single();

    if (reqErr || !csvReq) {
      return new Response(JSON.stringify({ error: reqErr?.message || 'Request not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let requesterName = 'Administrador';
    if (csvReq.requested_by) {
      const { data: requester } = await admin
        .from('profiles')
        .select('name')
        .eq('id', csvReq.requested_by)
        .single();
      if (requester?.name) requesterName = requester.name;
    }

    const resendKey = Deno.env.get('RESEND_API_KEY');
    let emailSent = false;

    if (resendKey) {
      const date = new Date(csvReq.created_at).toLocaleString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        dateStyle: 'short',
        timeStyle: 'short',
      });

      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: 'Allay <onboarding@resend.dev>',
          to: ['allay.corporate@gmail.com'],
          subject: `[Allay] Nueva solicitud CSV — ${csvReq.company_id}`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fff;">
              <div style="background:#7c3aed;padding:20px 24px;border-radius:12px 12px 0 0;">
                <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;">Nueva solicitud de carga CSV</h1>
              </div>
              <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
                <p style="color:#374151;margin-top:0;">
                  <strong>${requesterName}</strong> solicitó cargar un archivo CSV con empleados en la plataforma Allay.
                </p>
                <table style="width:100%;border-collapse:collapse;font-size:14px;color:#374151;margin-top:16px;">
                  <tr style="background:#f9fafb;">
                    <td style="padding:10px 12px;font-weight:600;border:1px solid #e5e7eb;width:130px;">Empresa</td>
                    <td style="padding:10px 12px;border:1px solid #e5e7eb;">${csvReq.company_id}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 12px;font-weight:600;border:1px solid #e5e7eb;">Archivo</td>
                    <td style="padding:10px 12px;border:1px solid #e5e7eb;">${csvReq.file_name || 'archivo.csv'}</td>
                  </tr>
                  <tr style="background:#f9fafb;">
                    <td style="padding:10px 12px;font-weight:600;border:1px solid #e5e7eb;">Empleados</td>
                    <td style="padding:10px 12px;border:1px solid #e5e7eb;">${csvReq.row_count} filas</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 12px;font-weight:600;border:1px solid #e5e7eb;">Fecha</td>
                    <td style="padding:10px 12px;border:1px solid #e5e7eb;">${date}</td>
                  </tr>
                </table>
                <p style="color:#6b7280;font-size:13px;margin-top:20px;padding:12px;background:#f3f4f6;border-radius:8px;">
                  Ingresá a la plataforma Allay → Panel de Administrador → Solicitudes CSV para revisar y aprobar o rechazar.
                </p>
              </div>
            </div>
          `,
          text: `Nueva solicitud CSV de ${requesterName} — ${csvReq.company_id} — ${csvReq.row_count} filas — ${date}. Ingresá a Allay para aprobar o rechazar.`,
        }),
      });

      const resendJson = await emailRes.json().catch(() => ({}));
      console.log('[notify-csv] Resend response:', emailRes.status, JSON.stringify(resendJson));
      emailSent = emailRes.ok;
    }

    return new Response(JSON.stringify({ ok: true, emailSent }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[notify-csv] error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
