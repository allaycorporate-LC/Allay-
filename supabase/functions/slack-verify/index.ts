import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function htmlPage(title: string, emoji: string, heading: string, body: string): Response {
  return new Response(
    `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — Allay</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: linear-gradient(135deg, #f0f8ff 0%, #fff4f9 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { background: white; border-radius: 20px; padding: 48px 40px; max-width: 440px; width: 100%; box-shadow: 0 8px 32px rgba(0,0,0,0.08); text-align: center; }
    .emoji { font-size: 56px; margin-bottom: 16px; }
    h1 { color: #1f2937; font-size: 22px; margin-bottom: 12px; }
    p { color: #6b7280; font-size: 15px; line-height: 1.6; }
    .purple { color: #7c3aed; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <div class="emoji">${emoji}</div>
    <h1>${heading}</h1>
    <p>${body}</p>
  </div>
</body>
</html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=UTF-8' } }
  );
}

Deno.serve(async (req) => {
  if (req.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });

  const url   = new URL(req.url);
  const token = url.searchParams.get('token')?.trim();

  if (!token || !/^[0-9a-f]{64}$/.test(token)) {
    return htmlPage('Link inválido', '❌', 'Link inválido', 'El link de verificación no es válido. Solicitá uno nuevo con /allay link tu@email.com en Slack.');
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: tokenRow } = await admin
    .from('slack_link_tokens')
    .select('id, email, slack_user_id, expires_at, used')
    .eq('token', token)
    .maybeSingle();

  if (!tokenRow) return htmlPage('Link inválido', '❌', 'Link inválido o expirado', 'El link no existe o ya fue usado. Solicitá uno nuevo.');
  if (tokenRow.used) return htmlPage('Ya usado', '⚠️', 'Este link ya fue utilizado', 'La vinculación ya fue completada.');
  if (new Date(tokenRow.expires_at) < new Date()) return htmlPage('Expirado', '⏰', 'El link expiró', 'Los links son válidos por 15 minutos. Solicitá uno nuevo.');

  const { error: markErr } = await admin.from('slack_link_tokens').update({ used: true }).eq('id', tokenRow.id).eq('used', false);
  if (markErr) return htmlPage('Error', '❌', 'Error al verificar', 'Intentá de nuevo o contactá al soporte.');

  const { error: updateErr } = await admin.from('profiles').update({ slack_user_id: tokenRow.slack_user_id }).eq('email', tokenRow.email);
  if (updateErr) return htmlPage('Error', '❌', 'No pudimos completar la vinculación', 'Contactá al soporte.');

  return htmlPage('¡Listo!', '✅', '¡Tu cuenta quedó vinculada!', `Tu email <span class="purple">${tokenRow.email}</span> ya está conectado con Slack en Allay.`);
});
