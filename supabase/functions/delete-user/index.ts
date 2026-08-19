import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
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

  const { data: caller } = await callerClient
    .from('profiles')
    .select('id, email, role, company_id')
    .single();

  if (!caller || !['admin', 'superadmin'].includes(caller.role)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { user_id } = await req.json();

  // Fetch target profile before deletion (for audit + company scope check)
  const { data: targetProfile } = await adminClient
    .from('profiles')
    .select('name, email, role, company_id')
    .eq('id', user_id)
    .single();

  // Admins can only delete users from their own company
  if (caller.role === 'admin') {
    if (!targetProfile || targetProfile.company_id !== caller.company_id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  const { error } = await adminClient.auth.admin.deleteUser(user_id);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Audit log
  await adminClient.from('audit_logs').insert({
    actor_id:    caller.id,
    actor_email: caller.email,
    actor_role:  caller.role,
    company_id:  targetProfile?.company_id || null,
    action:      'user.delete',
    target_id:   user_id,
    target_type: 'user',
    target_name: targetProfile?.name || user_id,
    metadata:    { email: targetProfile?.email, role: targetProfile?.role },
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
