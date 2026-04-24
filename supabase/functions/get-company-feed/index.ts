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
    const body = await req.json();
    const { company_id, offset = 0, limit = 10, program = null, analytics = false, from_date = null, to_date = null } = body;

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Analytics mode: lightweight select, no pagination, with optional date range
    if (analytics) {
      let q = adminClient
        .from('recognitions')
        .select('id, points, from_user_id, to_user_id, created_at')
        .order('created_at', { ascending: true })
        .limit(5000);
      if (company_id) q = q.eq('company_id', company_id);
      if (from_date)  q = q.gte('created_at', from_date);
      if (to_date)    q = q.lte('created_at', to_date);
      const { data, error } = await q;
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ data: data || [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let query = adminClient
      .from('recognitions')
      .select(`
        id, points, program, message, created_at, company_id,
        from_user:profiles!recognitions_from_user_id_fkey(id, name),
        to_user:profiles!recognitions_to_user_id_fkey(id, name),
        reactions(emoji, user_id),
        comments(id, message, created_at, user:profiles!comments_user_id_fkey(id, name))
      `)
      .order('created_at', { ascending: false });

    if (company_id) query = query.eq('company_id', company_id);
    if (program)    query = query.eq('program', program);

    const { data, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ data: data || [] }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
