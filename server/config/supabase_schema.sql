-- ==============================================================================
-- FORMAT STUDIO — PRODUCTION FRESH-LAUNCH SCHEMA & PERMISSIONS SPECIFICATION
-- ==============================================================================
-- Target Project: qrntmoeoqqmnkgdsxmrv (https://qrntmoeoqqmnkgdsxmrv.supabase.co)
-- Application: Format Studio
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 1. PROFILES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  org TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  payment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS org TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payment_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Reconcile defaults and nullability
ALTER TABLE public.profiles ALTER COLUMN plan SET DEFAULT 'free';
ALTER TABLE public.profiles ALTER COLUMN plan SET NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN created_at SET DEFAULT timezone('utc'::text, now());
ALTER TABLE public.profiles ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN updated_at SET DEFAULT timezone('utc'::text, now());
ALTER TABLE public.profiles ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_plan_check 
  CHECK (plan IN ('free', 'pro', 'team'));


-- ==============================================================================
-- 2. DOCUMENTS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  pages INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'done',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS doc_type TEXT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS pages INTEGER;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- Reconcile defaults and nullability
ALTER TABLE public.documents ALTER COLUMN doc_type SET NOT NULL;
ALTER TABLE public.documents ALTER COLUMN file_name SET NOT NULL;
ALTER TABLE public.documents ALTER COLUMN pages SET DEFAULT 1;
ALTER TABLE public.documents ALTER COLUMN status SET DEFAULT 'done';
ALTER TABLE public.documents ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.documents ALTER COLUMN created_at SET DEFAULT timezone('utc'::text, now());
ALTER TABLE public.documents ALTER COLUMN created_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS documents_user_id_created_at_idx 
  ON public.documents(user_id, created_at DESC);


-- ==============================================================================
-- 3. PAYMENTS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_id TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS amount INTEGER;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- Reconcile defaults and nullability
ALTER TABLE public.payments ALTER COLUMN payment_id SET NOT NULL;
ALTER TABLE public.payments ALTER COLUMN amount SET NOT NULL;
ALTER TABLE public.payments ALTER COLUMN created_at SET DEFAULT timezone('utc'::text, now());
ALTER TABLE public.payments ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_user_id_fkey;
ALTER TABLE public.payments ADD CONSTRAINT payments_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS payments_user_id_idx 
  ON public.payments(user_id);


-- ==============================================================================
-- 4. PRIVILEGE & GRANT RECONCILIATION
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.documents FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.payments FROM PUBLIC, anon, authenticated;

REVOKE ALL (id, full_name, email, phone, org, plan, created_at, payment_id) ON public.profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL (id, user_id, doc_type, file_name, pages, status, created_at) ON public.documents FROM PUBLIC, anon, authenticated;
REVOKE ALL (id, user_id, payment_id, amount, created_at) ON public.payments FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.profiles, public.documents, public.payments TO postgres, service_role;

GRANT SELECT, INSERT ON public.profiles TO authenticated;
GRANT UPDATE (name, full_name, phone, org, updated_at) ON public.profiles TO authenticated;

GRANT SELECT ON public.documents TO authenticated;
GRANT SELECT ON public.payments TO authenticated;


-- ==============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT schemaname, tablename, policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename IN ('profiles', 'documents', 'payments')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = id
    AND (plan IS NULL OR plan = 'free')
    AND payment_id IS NULL
  );

CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "documents_select_own"
  ON public.documents
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "payments_select_own"
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);


-- ==============================================================================
-- 6. TRIGGERS & FIELD IMMUTABILITY FUNCTIONS
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_profile_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_role text;
BEGIN
  v_role := coalesce(
    auth.role(),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    nullif(current_setting('request.jwt.claim.role', true), ''),
    current_user
  );

  IF v_role NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    IF NEW.plan IS NOT NULL AND NEW.plan != 'free' THEN
      RAISE EXCEPTION 'Unauthorized: Initial plan must be free' USING ERRCODE = '42501';
    END IF;
    IF NEW.payment_id IS NOT NULL THEN
      RAISE EXCEPTION 'Unauthorized: payment_id must be null on creation' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.name IS NOT NULL AND NEW.name != '' THEN
    NEW.full_name := coalesce(NEW.full_name, NEW.name);
    IF NEW.full_name IS NULL OR NEW.full_name = '' THEN
      NEW.full_name := NEW.name;
    END IF;
  ELSIF NEW.full_name IS NOT NULL AND NEW.full_name != '' THEN
    NEW.name := NEW.full_name;
  END IF;

  NEW.plan := coalesce(NEW.plan, 'free');
  NEW.created_at := coalesce(NEW.created_at, timezone('utc'::text, now()));
  NEW.updated_at := coalesce(NEW.updated_at, timezone('utc'::text, now()));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_handle_profile_insert ON public.profiles;
CREATE TRIGGER tr_handle_profile_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_insert();

CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER AS $$
DECLARE
  v_role text;
BEGIN
  v_role := coalesce(
    auth.role(),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    nullif(current_setting('request.jwt.claim.role', true), ''),
    current_user
  );

  IF v_role IN ('service_role', 'postgres', 'supabase_admin') THEN
    NEW.updated_at := timezone('utc'::text, now());
    RETURN NEW;
  END IF;

  IF (NEW.plan IS DISTINCT FROM OLD.plan) OR (NEW.payment_id IS DISTINCT FROM OLD.payment_id) THEN
    RAISE EXCEPTION 'Unauthorized: plan and payment_id can only be updated by service role'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.name IS DISTINCT FROM OLD.name AND NEW.name IS NOT NULL THEN
    NEW.full_name := NEW.name;
  ELSIF NEW.full_name IS DISTINCT FROM OLD.full_name AND NEW.full_name IS NOT NULL THEN
    NEW.name := NEW.full_name;
  ELSIF NEW.name IS NOT NULL AND NEW.full_name IS NULL THEN
    NEW.full_name := NEW.name;
  ELSIF NEW.full_name IS NOT NULL AND NEW.name IS NULL THEN
    NEW.name := NEW.full_name;
  END IF;

  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_protect_profile_fields ON public.profiles;
CREATE TRIGGER tr_protect_profile_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_fields();

COMMIT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'documents'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
  END IF;
END $$;
