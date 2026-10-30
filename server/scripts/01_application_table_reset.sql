-- ==============================================================================
-- FORMAT STUDIO — APPLICATION TABLE FRESH-LAUNCH RESET SQL
-- ==============================================================================
-- Target Project: qrntmoeoqqmnkgdsxmrv (https://qrntmoeoqqmnkgdsxmrv.supabase.co)
-- Purpose: Cleanly truncate only the three explicitly approved application tables
--          together in a single transaction with RESTRICT behavior.
--
-- SAFETY GUARDS:
-- 1. Does NOT use blanket CASCADE — uses RESTRICT to immediately abort if any
--    unexpected foreign key dependency exists.
-- 2. Does NOT drop schemas (public, auth, storage).
-- 3. Does NOT touch Supabase-managed Auth tables (auth.users, auth.identities, etc.).
--
-- Execution location: Supabase Dashboard SQL Editor (Project qrntmoeoqqmnkgdsxmrv)
-- ==============================================================================

BEGIN;

-- Explicitly truncate ONLY approved application tables together with RESTRICT
TRUNCATE TABLE 
  public.payments,
  public.documents,
  public.profiles
RESTART IDENTITY
RESTRICT;

COMMIT;

-- Post-truncation verification (must return exactly 0 for all three tables)
SELECT 
  (SELECT count(*) FROM public.profiles) AS profiles_count,
  (SELECT count(*) FROM public.documents) AS documents_count,
  (SELECT count(*) FROM public.payments) AS payments_count;
