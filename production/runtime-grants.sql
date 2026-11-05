-- Run as migration owner after creating a separate LOGIN role ldm_runtime through
-- your approved secrets/DB administration process. Never put a password here.
GRANT CONNECT ON DATABASE legaldocmanager TO ldm_runtime;
GRANT USAGE ON SCHEMA public TO ldm_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ldm_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ldm_runtime;
REVOKE UPDATE, DELETE ON audit FROM ldm_runtime;
REVOKE INSERT, UPDATE, DELETE ON schema_migrations FROM ldm_runtime;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
-- The runtime must not own tables, have SUPERUSER/BYPASSRLS, be a member of the
-- migration role, or hold schema/table DDL privileges. FORCE RLS is also enabled.
