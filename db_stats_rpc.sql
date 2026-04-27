-- ══════════════════════════════════════════════════════════
-- Oblivion Guild Portal — DB Stats RPC
-- Run this once in Supabase SQL Editor
-- Only the Architect can call this from the web app
-- ══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_db_stats()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total_size_pretty', pg_size_pretty(pg_database_size(current_database())),
    'total_bytes',       pg_database_size(current_database()),
    'free_tier_limit_bytes', 524288000, -- 500MB in bytes
    'tables', (
      SELECT json_agg(t ORDER BY t.row_count DESC)
      FROM (
        SELECT
          relname                                                        AS table_name,
          n_live_tup                                                     AS row_count,
          pg_size_pretty(pg_total_relation_size(quote_ident(relname))) AS size_pretty,
          pg_total_relation_size(quote_ident(relname))                  AS size_bytes
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
      ) t
    )
  );
$$;

-- Grant execute to authenticated users
-- (the app already enforces Architect-only at the UI level)
GRANT EXECUTE ON FUNCTION get_db_stats() TO authenticated;
