import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// In-memory rate limiter (per-instance): 10 requests per IP per minute
const _rl = new Map<string, { n: number; reset: number }>();
function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const e = _rl.get(key);
  if (!e || now > e.reset) { _rl.set(key, { n: 1, reset: now + windowMs }); return true; }
  if (e.n >= max) return false;
  e.n++;
  return true;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (!rateLimit(`create-user:${ip}`, 10, 60_000)) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Verify caller token
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user: caller }, error: authError } = await userClient.auth.getUser();
  if (authError || !caller) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Check caller role — must be admin or superadmin
  const { data: callerProfile } = await adminClient
    .from('profiles')
    .select('role, company_id')
    .eq('id', caller.id)
    .single();

  if (!callerProfile || !['admin', 'superadmin'].includes(callerProfile.role)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();

    // Admins can only create users for their own company
    if (callerProfile.role === 'admin' && body.company_id !== callerProfile.company_id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data, error } = await adminClient.auth.admin.createUser({
      email:         body.email,
      password:      body.password,
      email_confirm: true,
      user_metadata: {
        name:             body.name,
        department:       body.department,
        company_id:       body.company_id,
        role:             body.role,
        points_to_give:   body.points_to_give,
        points_to_redeem: body.points_to_redeem,
        birthday:         body.birthday         || null,
        anniversary_date: body.anniversary_date || null,
        auto_birthday:    body.auto_birthday    ?? true,
        auto_anniversary: body.auto_anniversary ?? true,
      },
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Belt-and-suspenders: directly update profile with dates (trigger may not pick them up)
    if (data.user?.id && (body.birthday || body.anniversary_date)) {
      await adminClient.from('profiles').update({
        birthday:         body.birthday         || null,
        anniversary_date: body.anniversary_date || null,
        auto_birthday:    body.auto_birthday    ?? true,
        auto_anniversary: body.auto_anniversary ?? true,
      }).eq('id', data.user.id);
    }

    // Audit log
    await adminClient.from('audit_logs').insert({
      actor_id:    caller.id,
      actor_email: caller.email,
      actor_role:  callerProfile.role,
      company_id:  body.company_id || null,
      action:      'user.create',
      target_id:   data.user?.id,
      target_type: 'user',
      target_name: body.name,
      metadata:    { email: body.email, role: body.role, department: body.department },
    });

    return new Response(JSON.stringify({ user: data.user }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
