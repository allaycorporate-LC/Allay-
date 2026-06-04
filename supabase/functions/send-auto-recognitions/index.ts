// ─────────────────────────────────────────────────────────────────────────────
// Allay — Auto Recognitions
//
// Envía reconocimientos automáticos de cumpleaños y aniversario.
// Cron Job (cada 15 minutos):
//   select cron.schedule('allay-auto-recognitions', '*/15 * * * *',
//     $$select net.http_post(
//       url := 'https://smuwnjpmpmwfuysrxkaa.supabase.co/functions/v1/send-auto-recognitions',
//       headers := '{"Content-Type":"application/json","Authorization":"Bearer <service_role_key>"}'::jsonb,
//       body := '{}'::jsonb)$$);
//
// La función sólo procesa empresas cuya send_time (HH:MM UTC) coincida
// con la hora actual en UTC (redondeada a bloques de 15 min).
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([^}]+)\}/g, (_, key) => vars[key] ?? '');
}

function todayDDMM(): string {
  const d = new Date();
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

function yearsDiff(dateStr: string): number {
  const past = new Date(dateStr);
  const now  = new Date();
  return now.getUTCFullYear() - past.getUTCFullYear();
}

function isAnniversaryToday(dateStr: string): boolean {
  const d  = new Date(dateStr);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}` === todayDDMM();
}

// Returns current UTC time as "HH:MM" rounded down to the nearest 15-min block
function currentUtcHHMM(): string {
  const now = new Date();
  const hh  = String(now.getUTCHours()).padStart(2, '0');
  const raw = now.getUTCMinutes();
  const mm  = String(Math.floor(raw / 15) * 15).padStart(2, '0');
  return `${hh}:${mm}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Allow manual override via ?force=true to skip time check
  const url    = new URL(req.url);
  const force  = url.searchParams.get('force') === 'true';
  const nowHHMM = currentUtcHHMM();
  const today   = todayDDMM();

  const summary: { sent: number; skipped: number; errors: string[]; time: string } = {
    sent: 0, skipped: 0, errors: [], time: nowHHMM,
  };

  // Load all enabled settings
  const { data: settingsList } = await admin
    .from('auto_recognition_settings')
    .select('*')
    .eq('enabled', true);

  if (!settingsList?.length) {
    return new Response(JSON.stringify({ message: 'No companies with auto recognitions enabled.', ...summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  for (const settings of settingsList) {
    // Skip companies whose send_time doesn't match current UTC time (unless forced)
    const compSendTime = settings.send_time || '09:00';
    if (!force && compSendTime !== nowHHMM) {
      summary.skipped++;
      continue;
    }

    const companyId = settings.company_id;

    // Get first admin of this company as sender
    const { data: adminUser } = await admin
      .from('profiles')
      .select('id, name')
      .eq('company_id', companyId)
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle();

    if (!adminUser) { summary.skipped++; continue; }

    // ── Birthdays ────────────────────────────────────────────────────────────
    if (settings.birthday_enabled) {
      const { data: birthdayUsers } = await admin
        .from('profiles')
        .select('id, name, department')
        .eq('company_id', companyId)
        .eq('birthday', today)
        .eq('auto_birthday', true);

      for (const user of (birthdayUsers || [])) {
        const firstName = user.name.split(' ')[0];
        const message = fillTemplate(settings.birthday_message, {
          nombre:          firstName,
          nombre_completo: user.name,
          equipo:          user.department || '',
        });

        const { error } = await admin.rpc('send_recognition_as', {
          p_from_user_id: adminUser.id,
          p_to_user_id:   user.id,
          p_points:       settings.birthday_points || 0,
          p_program:      settings.birthday_program || '🎂 Cumpleaños',
          p_message:      message,
          p_company_id:   companyId,
        });

        if (error) { summary.errors.push(`Birthday ${user.name}: ${error.message}`); }
        else summary.sent++;
      }
    }

    // ── Anniversaries ────────────────────────────────────────────────────────
    if (settings.anniversary_enabled) {
      const { data: allCompanyUsers } = await admin
        .from('profiles')
        .select('id, name, department, anniversary_date')
        .eq('company_id', companyId)
        .eq('auto_anniversary', true)
        .not('anniversary_date', 'is', null);

      for (const user of (allCompanyUsers || [])) {
        if (!isAnniversaryToday(user.anniversary_date)) continue;
        const years = yearsDiff(user.anniversary_date);
        if (years < 1) continue;
        const firstName = user.name.split(' ')[0];
        const message = fillTemplate(settings.anniversary_message, {
          nombre:          firstName,
          nombre_completo: user.name,
          equipo:          user.department || '',
          años:            String(years),
        });

        const { error } = await admin.rpc('send_recognition_as', {
          p_from_user_id: adminUser.id,
          p_to_user_id:   user.id,
          p_points:       settings.anniversary_points || 0,
          p_program:      settings.anniversary_program || '🎉 Aniversario',
          p_message:      message,
          p_company_id:   companyId,
        });

        if (error) { summary.errors.push(`Anniversary ${user.name}: ${error.message}`); }
        else summary.sent++;
      }
    }
  }

  return new Response(JSON.stringify({ date: today, ...summary }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
