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

  // Verificar que el caller sea admin o superadmin
  const callerClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: caller } = await callerClient
    .from('profiles')
    .select('role')
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

  const body = await req.json();

  const { data, error } = await adminClient.auth.admin.createUser({
    email:          body.email,
    password:       body.password,
    email_confirm:  true,
    user_metadata: {
      name:             body.name,
      department:       body.department,
      company_id:       body.company_id,
      role:             body.role,
      points_to_give:   body.points_to_give,
      points_to_redeem: body.points_to_redeem,
    },
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ user: data.user }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
