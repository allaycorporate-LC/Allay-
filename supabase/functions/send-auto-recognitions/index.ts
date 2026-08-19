// ─────────────────────────────────────────────────────────────────────────────
// Allay — Auto Recognitions
//
// Envía reconocimientos automáticos de cumpleaños y aniversario.
// Cron Job (cada hora en el minuto 0):
//   UPDATE cron.job SET schedule = '0 * * * *' WHERE jobname = 'allay-auto-recognitions';
//
// La función sólo procesa empresas cuya send_time (HH:00 UTC) coincida
// con la hora UTC actual.
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

// Returns current UTC hour as "HH:00" (cron runs at minute 0)
function currentUtcHHMM(): string {
  const now = new Date();
  const hh  = String(now.getUTCHours()).padStart(2, '0');
  return `${hh}:00`;
}

// ISO date string for today in UTC (YYYY-MM-DD)
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildEmailHtml(opts: {
  recipientName: string;
  message: string;
  isBirthday: boolean;
  years?: number;
  platformUrl: string;
}): string {
  const { recipientName, message, isBirthday, years, platformUrl } = opts;
  const emoji  = isBirthday ? '🎂' : '🎉';
  const title  = isBirthday
    ? `¡Feliz cumpleaños, ${recipientName}!`
    : `¡${recipientName}, ${years} año${years !== 1 ? 's' : ''} en el equipo!`;

  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f3ff;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(61,43,86,0.10);">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#3d2b56 0%,#6d3fa0 100%);padding:36px 32px 28px;text-align:center;">
      <div style="font-size:48px;margin-bottom:12px;">${emoji}</div>
      <h1 style="color:#ffffff;font-size:22px;font-weight:700;margin:0;line-height:1.3;">${title}</h1>
    </div>
    <!-- Body -->
    <div style="padding:32px;">
      <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 24px;white-space:pre-wrap;">${message.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
      <!-- CTA Button -->
      <div style="text-align:center;margin:28px 0;">
        <a href="${platformUrl}" style="display:inline-block;background:#3d2b56;color:#ffffff;font-size:15px;font-weight:600;padding:14px 32px;border-radius:12px;text-decoration:none;">
          Ver reconocimiento en Allay →
        </a>
      </div>
    </div>
    <!-- Footer -->
    <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;text-align:center;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">Este email fue enviado automáticamente por <strong>Allay</strong>.</p>
    </div>
  </div>
</body>
</html>`;
}

async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  resendKey: string;
}): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${opts.resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Allay <onboarding@resend.dev>',
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('[send-auto-recognitions] Resend error:', err);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url   = new URL(req.url);
  const force = url.searchParams.get('force') === 'true';

  const authHeader = req.headers.get('Authorization') || '';

  // ?force=true is a manual override — requires superadmin JWT
  if (force) {
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: callerProfile } = await callerClient
      .from('profiles')
      .select('role')
      .single();
    if (!callerProfile || callerProfile.role !== 'superadmin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const resendKey   = Deno.env.get('RESEND_API_KEY') || '';
  const platformUrl = Deno.env.get('SITE_URL') || 'https://allay.app';

  const nowHHMM = currentUtcHHMM();
  const today   = todayDDMM();
  const todayDate = todayISO();

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

    // Distributed lock: prevents duplicate sends if the cron fires twice simultaneously.
    // INSERT fails on conflict → another invocation already claimed this slot, skip.
    if (!force) {
      const runKey = `${todayDate} ${nowHHMM}`;
      const { error: lockErr } = await admin
        .from('auto_recognition_runs')
        .insert({ company_id: companyId, run_key: runKey });
      if (lockErr) {
        // Conflict (duplicate key) or other error → skip this company
        summary.skipped++;
        continue;
      }
    }

    // Get first admin or superadmin of this company as sender
    const { data: adminUser } = await admin
      .from('profiles')
      .select('id, name')
      .eq('company_id', companyId)
      .in('role', ['admin', 'superadmin'])
      .limit(1)
      .maybeSingle();

    if (!adminUser) { summary.skipped++; continue; }

    // Load today's already-sent recognitions for this company (deduplication)
    const { data: sentToday } = await admin
      .from('recognitions')
      .select('to_user_id, program')
      .eq('company_id', companyId)
      .eq('from_user_id', adminUser.id)
      .gte('created_at', `${todayDate}T00:00:00Z`)
      .lte('created_at', `${todayDate}T23:59:59Z`);

    const alreadySent = (toUserId: string, program: string) =>
      (sentToday || []).some(r => r.to_user_id === toUserId && r.program === program);

    // ── Birthdays ────────────────────────────────────────────────────────────
    if (settings.birthday_enabled) {
      const { data: birthdayUsers } = await admin
        .from('profiles')
        .select('id, name, department, email')
        .eq('company_id', companyId)
        .eq('birthday', today)
        .eq('auto_birthday', true);

      for (const user of (birthdayUsers || [])) {
        const program = settings.birthday_program || '🎂 Cumpleaños';

        // Skip if already sent today (deduplication)
        if (alreadySent(user.id, program)) {
          summary.skipped++;
          continue;
        }

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
          p_program:      program,
          p_message:      message,
          p_company_id:   companyId,
        });

        if (error) {
          summary.errors.push(`Birthday ${user.name}: ${error.message}`);
        } else {
          summary.sent++;
          // Send email notification if enabled
          if (settings.send_email_notification && user.email && resendKey) {
            await sendEmail({
              to: user.email,
              subject: `¡Feliz cumpleaños, ${firstName}! 🎂`,
              html: buildEmailHtml({ recipientName: firstName, message, isBirthday: true, platformUrl }),
              resendKey,
            });
          }
        }
      }
    }

    // ── Anniversaries ────────────────────────────────────────────────────────
    if (settings.anniversary_enabled) {
      const { data: allCompanyUsers } = await admin
        .from('profiles')
        .select('id, name, department, anniversary_date, email')
        .eq('company_id', companyId)
        .eq('auto_anniversary', true)
        .not('anniversary_date', 'is', null);

      for (const user of (allCompanyUsers || [])) {
        if (!isAnniversaryToday(user.anniversary_date)) continue;
        const years = yearsDiff(user.anniversary_date);
        if (years < 1) continue;

        const program = settings.anniversary_program || '🎉 Aniversario';

        // Skip if already sent today (deduplication)
        if (alreadySent(user.id, program)) {
          summary.skipped++;
          continue;
        }

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
          p_program:      program,
          p_message:      message,
          p_company_id:   companyId,
        });

        if (error) {
          summary.errors.push(`Anniversary ${user.name}: ${error.message}`);
        } else {
          summary.sent++;
          // Send email notification if enabled
          if (settings.send_email_notification && user.email && resendKey) {
            await sendEmail({
              to: user.email,
              subject: `¡${firstName}, ${years} año${years !== 1 ? 's' : ''} en el equipo! 🎉`,
              html: buildEmailHtml({ recipientName: firstName, message, isBirthday: false, years, platformUrl }),
              resendKey,
            });
          }
        }
      }
    }
  }

  return new Response(JSON.stringify({ date: today, ...summary }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
