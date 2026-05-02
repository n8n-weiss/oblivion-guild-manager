import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SB_MGMT_TOKEN = Deno.env.get("SB_MGMT_TOKEN");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!SB_MGMT_TOKEN) {
      throw new Error("SB_MGMT_TOKEN is not set.");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Auth Check
    const authHeader = req.headers.get('Authorization')!;
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const { data: roleData } = await supabase.from('user_roles').select('role').eq('uid', user.id).single();
    if (roleData?.role !== 'architect') return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });

    const projectRef = SUPABASE_URL.split('.')[0].split('//')[1];

    // 2. Fetch Project Info (Infrastructure)
    const projectResponse = await fetch(`https://api.supabase.com/v1/projects/${projectRef}`, {
        headers: { 'Authorization': `Bearer ${SB_MGMT_TOKEN.trim()}` }
    });
    const projectInfo = projectResponse.ok ? await projectResponse.json() : {};

    // 3. Fetch App Activity (Audit Logs)
    const { data: auditData } = await supabase
      .from('audit_logs')
      .select('user_name, action, timestamp')
      .order('timestamp', { ascending: false })
      .limit(5);

    // 4. Fetch Quick Stats (Pending items)
    const { count: pendingJoins } = await supabase.from('join_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending');
    const { count: pendingAbsences } = await supabase.from('absences').select('*', { count: 'exact', head: true }).eq('status', 'pending');

    return new Response(JSON.stringify({
      project: projectInfo,
      audit: auditData || [],
      stats: {
        pendingJoins: pendingJoins || 0,
        pendingAbsences: pendingAbsences || 0
      },
      projectRef,
      status: "Success"
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})
