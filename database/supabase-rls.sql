-- Lock down the public schema on Supabase (fixes the security advisor warnings)
--
-- Advisors addressed:
--   rls_disabled_in_public    - high_scores / game_sessions readable+writable by anyone
--   sensitive_columns_exposed - player_name exposed through the PostgREST API
--
-- Safe for this app: the API talks to Postgres directly with the `postgres`
-- role (see api/lib/db.js), which owns these tables and has BYPASSRLS, so it is
-- unaffected. Nothing in client/ uses the Supabase JS SDK or the anon key, so
-- there is no legitimate PostgREST traffic to preserve.
--
-- Run with:  psql "$POSTGRES_URL_NON_POOLING" -f database/supabase-rls.sql
-- Or paste into the Supabase SQL Editor.

BEGIN;

-- 1. Enable RLS. No policies are created, so anon/authenticated get nothing.
ALTER TABLE public.high_scores   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

-- 2. Views bypass RLS by default (they run with the definer's rights), so the
--    leaderboard view would still leak high_scores. Make it run as the caller.
ALTER VIEW public.leaderboard SET (security_invoker = on);

-- 3. Belt and braces: drop the blanket grants Supabase hands to the API roles.
REVOKE ALL ON public.high_scores   FROM anon, authenticated;
REVOKE ALL ON public.game_sessions FROM anon, authenticated;
REVOKE ALL ON public.leaderboard   FROM anon, authenticated;

REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

COMMIT;
