-- StructPaper PostgreSQL Extensions and Schema Initialization
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Dedicated schema for pg-boss job queues
CREATE SCHEMA IF NOT EXISTS pgboss;
