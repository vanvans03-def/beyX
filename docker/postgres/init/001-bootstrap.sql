\set ON_ERROR_STOP on
\getenv app_password LOCAL_POSTGRES_APP_PASSWORD
\getenv backup_password LOCAL_POSTGRES_BACKUP_PASSWORD

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

SELECT format(
  'CREATE ROLE beyx_app LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS PASSWORD %L',
  :'app_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'beyx_app')
\gexec

SELECT format(
  'CREATE ROLE beyx_backup LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L',
  :'backup_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'beyx_backup')
\gexec

ALTER ROLE beyx_app SET statement_timeout = '30s';
ALTER ROLE beyx_app SET idle_in_transaction_session_timeout = '30s';
ALTER ROLE beyx_backup SET default_transaction_read_only = on;
ALTER ROLE beyx_backup SET statement_timeout = '10min';

SELECT format('GRANT CONNECT ON DATABASE %I TO beyx_app, beyx_backup', current_database())
\gexec

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO beyx_app, beyx_backup;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO beyx_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO beyx_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO beyx_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO beyx_backup;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO beyx_backup;

COMMENT ON ROLE beyx_app IS
  'Server-only compatibility role. BYPASSRLS matches the former Supabase service role and must be reviewed before production hardening.';
COMMENT ON ROLE beyx_backup IS 'Read-only role for off-host logical backups and restore verification.';

