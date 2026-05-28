// ─────────────────────────────────────────────────────────────────────────────
// Allay — Slack Slash Command Webhook
// ─────────────────────────────────────────────────────────────────────────────
// Setup en Slack:
//   1. Creá una app en https://api.slack.com/apps
//   2. Activá "Slash Commands" y apuntá la URL a esta Edge Function
//   3. Copiá el "Signing Secret" y agregalo en Supabase como secret:
//      supabase secrets set SLACK_SIGNING_SECRET=xoxb-...
//   4. El comando: /allay @nombre programa mensaje
//      Ejemplo:   /allay @ana Innovación Gran trabajo hoy!
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_POINTS = 10;

async function verifySlackSignature(req: Request, body: string): Promise<boolean> {
  const signingSecret = Deno.env.get('SLACK_SIGNING_SECRET');
  if (!signingSecret) {
    console.warn('SLACK_SIGNING_SECRET not set — skipping verification (dev mode)');
    return true;
  }

  const timestamp = req.headers.get('X-Slack-Request-Timestamp') || '';
  const slackSig  = req.headers.get('X-Slack-Signature') || '';

  if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) return false;

  const baseStr = `v0:${timestamp}:${body}`;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(baseStr));
  const hex = 'v0=' + Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return hex === slackSig;
}

function slackResponse(text: string, inChannel = false) {
  return new Response(
    JSON.stringify({ response_type: inChannel ? 'in_channel' : 'ephemeral', text }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const rawBody = await req.text();

  if (!(await verifySlackSignature(req, rawBody))) {
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const params      = new URLSearchParams(rawBody);
  const slackUserId = params.get('user_id') || '';
  const text        = (params.get('text') || '').trim();

  // Comando: /allay link → vincula cuenta
  if (text.startsWith('link ')) {
    const email = text.replace('link ', '').trim().toLowerCase();
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { error } = await admin
      .from('profiles')
      .update({ slack_user_id: slackUserId })
      .eq('email', email);

    return slackResponse(
      error
        ? `⚠️ No encontré una cuenta con el email \`${email}\`. Verificá que sea tu email de Allay.`
        : `✅ Tu cuenta de Slack quedó vinculada a \`${email}\` en Allay. ¡Ya podés reconocer a tus compañeros!`
    );
  }

  // Comando: /allay help
  if (!text || text === 'help') {
    return slackResponse(
      `*Comandos de Allay:*\n` +
      `• \`/allay link tu@email.com\` — vinculá tu cuenta (solo la primera vez)\n` +
      `• \`/allay @nombre programa mensaje\` — enviá un reconocimiento\n\n` +
      `_Ejemplo:_ \`/allay @ana Innovación Gran trabajo en el demo de hoy! 🚀\``
    );
  }

  // Comando: /allay @nombre programa mensaje
  const parts = text.split(/\s+/);
  if (parts.length < 3) {
    return slackResponse(
      '⚠️ Formato incorrecto.\nUsá: `/allay @nombre programa mensaje`\n' +
      'Ejemplo: `/allay @ana Innovación Gran trabajo!`'
    );
  }

  const recipientQuery = parts[0].replace(/^@/, '').toLowerCase();
  const program        = parts[1];
  const message        = parts.slice(2).join(' ');

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Buscar sender por slack_user_id
  const { data: sender } = await admin
    .from('profiles')
    .select('id, name, company_id, points_to_give')
    .eq('slack_user_id', slackUserId)
    .single();

  if (!sender) {
    return slackResponse(
      '⚠️ No encontré tu cuenta de Allay.\n' +
      'Vinculate primero con: `/allay link tu@email.com`'
    );
  }

  if (sender.points_to_give < DEFAULT_POINTS) {
    return slackResponse(`⚠️ No tenés suficientes puntos para enviar (necesitás ${DEFAULT_POINTS} pts).`);
  }

  // Buscar destinatario por nombre (misma empresa)
  const { data: matches } = await admin
    .from('profiles')
    .select('id, name')
    .eq('company_id', sender.company_id)
    .ilike('name', `%${recipientQuery}%`)
    .neq('id', sender.id);

  if (!matches || matches.length === 0) {
    return slackResponse(`⚠️ No encontré empleados con el nombre \`${recipientQuery}\`. Verificá que esté bien escrito.`);
  }
  if (matches.length > 1) {
    const names = matches.map(m => m.name).join(', ');
    return slackResponse(`⚠️ Hay varios empleados con ese nombre: *${names}*. Sé más específico.`);
  }

  const recipient = matches[0];

  // Buscar programa (match parcial, empresa del sender)
  const { data: prog } = await admin
    .from('programs')
    .select('name, emoji')
    .eq('company_id', sender.company_id)
    .eq('active', true)
    .ilike('name', `%${program}%`)
    .limit(1)
    .maybeSingle();

  const programLabel = prog ? `${prog.emoji} ${prog.name}` : program;

  // Enviar reconocimiento
  const { error } = await admin.rpc('send_recognition_as', {
    p_from_user_id: sender.id,
    p_to_user_id:   recipient.id,
    p_points:       DEFAULT_POINTS,
    p_program:      programLabel,
    p_message:      message,
    p_company_id:   sender.company_id
  });

  if (error) {
    const msg = error.message === 'insufficient_points'
      ? '⚠️ No tenés suficientes puntos.'
      : `⚠️ Error al enviar: ${error.message}`;
    return slackResponse(msg);
  }

  return slackResponse(
    `🏆 *${sender.name}* reconoció a *${recipient.name}* por *${programLabel}*\n` +
    `> ${message}\n` +
    `_+${DEFAULT_POINTS} puntos enviados desde Allay_ ✨`,
    true
  );
});
