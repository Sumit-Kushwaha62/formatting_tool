-- ==============================================================================
-- FORMAT STUDIO — READ-ONLY DATABASE INVENTORY & CATALOG QUERIES
-- ==============================================================================
-- Target Project: qrntmoeoqqmnkgdsxmrv (https://qrntmoeoqqmnkgdsxmrv.supabase.co)
-- Purpose: Catalog inspection queries using PostgreSQL system catalogs (OIDs)
--          to audit tables, columns, constraints, foreign keys across schemas,
--          grants, RLS policies, triggers (with function definitions), storage,
--          and realtime publications without modifying database state.
--
-- Execution location: Supabase Dashboard SQL Editor (Project qrntmoeoqqmnkgdsxmrv)
-- ==============================================================================

-- 1. Inventory of Public Tables & RLS Status
SELECT 
  schemaname,
  tablename,
  tableowner,
  hasindexes,
  hasrules,
  hastriggers,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 2. Column Inventory, Data Types, Nullability & Column Defaults
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- 3. Comprehensive Foreign Keys Involving Target Tables Across ALL Schemas
-- Inspects inbound and outbound foreign keys referencing or referenced by
-- public.profiles, public.documents, and public.payments regardless of source schema.
SELECT
  src_ns.nspname AS referencing_schema,
  src_cls.relname AS referencing_table,
  con.conname AS constraint_name,
  att_src.attname AS referencing_column,
  dst_ns.nspname AS referenced_schema,
  dst_cls.relname AS referenced_table,
  att_dst.attname AS referenced_column,
  CASE con.confdeltype
    WHEN 'a' THEN 'NO ACTION'
    WHEN 'r' THEN 'RESTRICT'
    WHEN 'c' THEN 'CASCADE'
    WHEN 'n' THEN 'SET NULL'
    WHEN 'd' THEN 'SET DEFAULT'
    ELSE con.confdeltype::text
  END AS delete_rule,
  CASE con.confupdtype
    WHEN 'a' THEN 'NO ACTION'
    WHEN 'r' THEN 'RESTRICT'
    WHEN 'c' THEN 'CASCADE'
    WHEN 'n' THEN 'SET NULL'
    WHEN 'd' THEN 'SET DEFAULT'
    ELSE con.confupdtype::text
  END AS update_rule
FROM pg_constraint con
JOIN pg_class src_cls ON src_cls.oid = con.conrelid
JOIN pg_namespace src_ns ON src_ns.oid = src_cls.relnamespace
JOIN pg_class dst_cls ON dst_cls.oid = con.confrelid
JOIN pg_namespace dst_ns ON dst_ns.oid = dst_cls.relnamespace
JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
JOIN pg_attribute att_src ON att_src.attrelid = con.conrelid AND att_src.attnum = k.attnum
JOIN LATERAL unnest(con.confkey) WITH ORDINALITY AS fk(attnum, ord) ON k.ord = fk.ord
JOIN pg_attribute att_dst ON att_dst.attrelid = con.confrelid AND att_dst.attnum = fk.attnum
WHERE con.contype = 'f'
  AND (
    (src_ns.nspname = 'public' AND src_cls.relname IN ('profiles', 'documents', 'payments'))
    OR
    (dst_ns.nspname = 'public' AND dst_cls.relname IN ('profiles', 'documents', 'payments'))
  )
ORDER BY referencing_schema, referencing_table, constraint_name;

-- 4. Explicit Table-Level Privilege Grants (anon, authenticated, service_role, PUBLIC)
SELECT 
  grantee, 
  table_schema, 
  table_name, 
  privilege_type, 
  is_grantable
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'documents', 'payments')
ORDER BY table_name, grantee, privilege_type;

-- 5. Explicit Column-Level Privilege Grants
SELECT 
  grantee, 
  table_schema, 
  table_name, 
  column_name, 
  privilege_type, 
  is_grantable
FROM information_schema.column_privileges
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'documents', 'payments')
ORDER BY table_name, column_name, grantee, privilege_type;

-- 6. Row Level Security (RLS) Policies Detailed Breakdown
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 7. Triggers & Source Function Definitions on Target Tables and auth.users (Catalog OID Join)
-- Accurately retrieves trigger function source code using pg_get_functiondef(proc.oid)
SELECT 
  ns.nspname AS table_schema,
  cls.relname AS table_name,
  trg.tgname AS trigger_name,
  CASE 
    WHEN (trg.tgtype & 2) = 2 THEN 'BEFORE'
    WHEN (trg.tgtype & 64) = 64 THEN 'INSTEAD OF'
    ELSE 'AFTER'
  END AS timing,
  concat_ws(' OR ',
    CASE WHEN (trg.tgtype & 4) = 4 THEN 'INSERT' END,
    CASE WHEN (trg.tgtype & 8) = 8 THEN 'DELETE' END,
    CASE WHEN (trg.tgtype & 16) = 16 THEN 'UPDATE' END
  ) AS manipulation,
  proc_ns.nspname AS function_schema,
  proc.proname AS function_name,
  proc.prosecdef AS is_security_definer,
  pg_get_functiondef(proc.oid) AS function_definition
FROM pg_trigger trg
JOIN pg_class cls ON cls.oid = trg.tgrelid
JOIN pg_namespace ns ON ns.oid = cls.relnamespace
JOIN pg_proc proc ON proc.oid = trg.tgfoid
JOIN pg_namespace proc_ns ON proc_ns.oid = proc.pronamespace
WHERE NOT trg.tgisinternal
  AND (
    (ns.nspname = 'public' AND cls.relname IN ('profiles', 'documents', 'payments'))
    OR (ns.nspname = 'auth' AND cls.relname = 'users')
  )
ORDER BY table_schema, table_name, trigger_name;

-- 8. Storage Buckets and Objects Count
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at,
  updated_at
FROM storage.buckets;

SELECT 
  bucket_id,
  count(*) AS object_count
FROM storage.objects
GROUP BY bucket_id;

-- 9. Realtime Publications
SELECT 
  pubname,
  schemaname,
  tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';
