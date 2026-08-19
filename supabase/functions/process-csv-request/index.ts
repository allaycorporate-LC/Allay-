import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CsvRow {
  nombre?: string; name?: string;
  email?: string; correo?: string;
  password?: string; contraseña?: string; pass?: string;
  departamento?: string; department?: string; depto?: string;
  empresa?: string; company_id?: string; company?: string;
  rol?: string; role?: string;
  puntos_para_dar?: string; to_give?: string; puntos_dar?: string;
  puntos_para_canjear?: string; to_redeem?: string; puntos_canjear?: string;
  cumpleaños?: string; cumpleanos?: string; birthday?: string; nacimiento?: string;
  aniversario?: string; anniversary?: string; fecha_ingreso?: string; ingreso?: string;
  [key: string]: string | undefined;
}

function parseCSV(csvText: string, fallbackCompanyId: string): Array<{
  name: string; email: string; password: string; department: string;
  company_id: string; role: string; points_to_give: number;
  points_to_redeem: number; birthday: string | null; anniversary_date: string | null;
}> {
  const lines = csvText.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const rawHeaders = lines[0].split(',').map(h => h.trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents
  );

  const idx = (keys: string[]) =>
    rawHeaders.findIndex(h => keys.some(k => h.includes(k)));

  const nameIdx        = idx(['nombre', 'name']);
  const emailIdx       = idx(['email', 'correo']);
  const passwordIdx    = idx(['contrasena', 'password', 'pass']);
  const deptIdx        = idx(['departamento', 'department', 'depto']);
  const companyIdx     = idx(['empresa', 'company_id', 'company']);
  const roleIdx        = idx(['rol', 'role']);
  const giveIdx        = idx(['para_dar', 'to_give', 'puntos_dar']);
  const redeemIdx      = idx(['para_canjear', 'to_redeem', 'puntos_canjear']);
  const birthdayIdx    = idx(['cumpleanos', 'cumpleaños', 'birthday', 'nacimiento']);
  const anniversaryIdx = idx(['aniversario', 'anniversary', 'fecha_ingreso', 'ingreso']);

  const result = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    if (cols.length < 2 || !cols[0]) continue;

    const email = (emailIdx !== -1 ? cols[emailIdx] : cols[1]) || '';
    if (!email) continue;

    const rawRole = (roleIdx !== -1 ? cols[roleIdx] : '') || 'employee';
    const role = ['employee', 'admin', 'superadmin'].includes(rawRole) ? rawRole : 'employee';

    // Birthday: normalize to DD/MM
    let birthday: string | null = null;
    if (birthdayIdx !== -1 && cols[birthdayIdx]) {
      const raw = cols[birthdayIdx].replace(/-/g, '/');
      if (/^\d{1,2}\/\d{1,2}$/.test(raw)) {
        birthday = raw.padStart(5, '0').substring(0, 5);
      }
    }

    // Anniversary: normalize to YYYY-MM-DD
    let anniversary_date: string | null = null;
    if (anniversaryIdx !== -1 && cols[anniversaryIdx]) {
      const raw = cols[anniversaryIdx];
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        anniversary_date = raw;
      } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
        const [d, m, y] = raw.split('/');
        anniversary_date = `${y}-${m}-${d}`;
      }
    }

    result.push({
      name:             (nameIdx !== -1 ? cols[nameIdx] : cols[0]) || cols[0],
      email,
      password:         (passwordIdx !== -1 ? cols[passwordIdx] : '') || 'Allay2024!',
      department:       (deptIdx !== -1 ? cols[deptIdx] : cols[2]) || 'General',
      company_id:       (companyIdx !== -1 ? cols[companyIdx] : '') || fallbackCompanyId,
      role,
      points_to_give:   parseInt((giveIdx !== -1 ? cols[giveIdx] : cols[3]) || '') || 100,
      points_to_redeem: parseInt((redeemIdx !== -1 ? cols[redeemIdx] : cols[4]) || '') || 0,
      birthday,
      anniversary_date,
    });
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { request_id, action, rejection_reason } = body;

    if (!request_id || !action) {
      return new Response(JSON.stringify({ error: 'Missing request_id or action' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify caller JWT and role
    const authHeader = req.headers.get('Authorization') || '';
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
    const { data: callerProfile, error: callerErr } = await callerClient
      .from('profiles')
      .select('id, email, role')
      .single();

    if (callerErr || !callerProfile || !['admin', 'superadmin'].includes(callerProfile.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const reviewerId = callerProfile.id;

    // Fetch the request
    const { data: csvReq, error: reqErr } = await admin
      .from('csv_requests')
      .select('*')
      .eq('id', request_id)
      .eq('status', 'pending')
      .single();

    if (reqErr || !csvReq) {
      return new Response(JSON.stringify({ error: 'Request not found or already processed' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const now = new Date().toISOString();

    // ── REJECT ───────────────────────────────────────────────────────────────────
    if (action === 'reject') {
      await admin.from('csv_requests').update({
        status: 'rejected',
        reviewed_at: now,
        reviewed_by: reviewerId,
        rejection_reason: rejection_reason || null,
      }).eq('id', request_id);

      if (csvReq.requested_by) {
        await admin.from('notifications').insert({
          user_id: csvReq.requested_by,
          type: 'csv_rejected',
          data: {
            request_id,
            file_name: csvReq.file_name || 'archivo.csv',
            rejection_reason: rejection_reason || null,
          },
          read: false,
        });
      }

      await admin.from('audit_logs').insert({
        actor_id:    callerProfile.id,
        actor_email: callerProfile.email,
        actor_role:  callerProfile.role,
        company_id:  csvReq.company_id || null,
        action:      'csv.reject',
        target_id:   request_id,
        target_type: 'csv_request',
        target_name: csvReq.file_name || 'archivo.csv',
        metadata:    { row_count: csvReq.row_count, rejection_reason: rejection_reason || null },
      });

      return new Response(JSON.stringify({ ok: true, action: 'rejected' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── APPROVE ──────────────────────────────────────────────────────────────────
    const employees = parseCSV(csvReq.csv_content, csvReq.company_id);

    if (employees.length === 0) {
      return new Response(JSON.stringify({ error: 'CSV has no valid rows' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: Array<{ email: string; ok: boolean; error: string | null }> = [];

    for (const emp of employees) {
      const meta = {
        name:             emp.name,
        department:       emp.department,
        company_id:       emp.company_id,
        role:             emp.role,
        points_to_give:   emp.points_to_give,
        points_to_redeem: emp.points_to_redeem,
        birthday:         emp.birthday,
        anniversary_date: emp.anniversary_date,
        auto_birthday:    true,
        auto_anniversary: true,
      };

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: emp.email, password: emp.password, email_confirm: true, user_metadata: meta,
      });

      if (!createErr && created?.user?.id) {
        await admin.from('profiles').update({
          birthday:         emp.birthday         || null,
          anniversary_date: emp.anniversary_date || null,
          auto_birthday:    true,
          auto_anniversary: true,
        }).eq('id', created.user.id);
        results.push({ email: emp.email, ok: true, error: null });
        continue;
      }

      // User already exists — update their profile directly via email lookup
      const alreadyExists = createErr.message?.toLowerCase().includes('already been registered')
        || createErr.message?.toLowerCase().includes('already exists');

      if (alreadyExists) {
        const { data: existingProfile } = await admin
          .from('profiles')
          .select('id')
          .eq('email', emp.email)
          .single();

        if (existingProfile?.id) {
          await admin.from('profiles').update({
            name:             emp.name,
            department:       emp.department,
            company_id:       emp.company_id,
            role:             emp.role,
            points_to_give:   emp.points_to_give,
            points_to_redeem: emp.points_to_redeem,
            birthday:         emp.birthday         || null,
            anniversary_date: emp.anniversary_date || null,
            auto_birthday:    true,
            auto_anniversary: true,
          }).eq('id', existingProfile.id);
          results.push({ email: emp.email, ok: true, error: null });
          continue;
        }
      }

      results.push({ email: emp.email, ok: false, error: createErr.message });
    }

    // Update request status
    await admin.from('csv_requests').update({
      status: 'approved',
      reviewed_at: now,
      reviewed_by: reviewerId,
    }).eq('id', request_id);

    // Notify requester
    const okCount   = results.filter(r => r.ok).length;
    const failCount = results.filter(r => !r.ok).length;
    if (csvReq.requested_by) {
      await admin.from('notifications').insert({
        user_id: csvReq.requested_by,
        type: 'csv_approved',
        data: {
          request_id,
          file_name: csvReq.file_name || 'archivo.csv',
          ok_count:   okCount,
          fail_count: failCount,
        },
        read: false,
      });
    }

    await admin.from('audit_logs').insert({
      actor_id:    callerProfile.id,
      actor_email: callerProfile.email,
      actor_role:  callerProfile.role,
      company_id:  csvReq.company_id || null,
      action:      'csv.approve',
      target_id:   request_id,
      target_type: 'csv_request',
      target_name: csvReq.file_name || 'archivo.csv',
      metadata:    { row_count: csvReq.row_count, ok_count: okCount, fail_count: failCount },
    });

    return new Response(JSON.stringify({ ok: true, action: 'approved', results, okCount, failCount }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
