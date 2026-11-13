# DEPRECATION NOTICE: Legacy Java Spring Boot Backend

> **Status:** DEPRECATED  
> **Superseded By:** `apps/api` (NestJS Fastify modular monolith) & `apps/worker` (NestJS pg-boss background worker)  
> **Effective Date:** November 2026

---

## 1. Overview

The legacy Spring Boot backend service previously hosted in `apps/api` has been moved to `apps/api-deprecated` and deprecated. All active API development, authentication, manuscript management, real-time op-log document synchronization, asset management, and LaTeX compilation pipelines are now implemented in the modern TypeScript/NestJS stack:

- **HTTP API:** `apps/api` (NestJS 10 + Fastify)
- **Background Worker:** `apps/worker` (NestJS + pg-boss)
- **Contracts & Shared SDK:** `packages/contracts`, `packages/db`, `packages/api-client`

---

## 2. Reason for Migration

1. **Unified Language & Ecosystem:** Unifies the full stack (frontend and backend) on TypeScript, enabling end-to-end type safety, shared Zod contract schemas, and code reuse.
2. **High-Performance Stateless HTTP:** Fastify provides significantly lower memory footprint and latency compared to standard Java JVM container deployments.
3. **Dedicated Background Queue:** Isolates heavy TeX/LaTeX compilation workloads to a worker process via `pg-boss`, preventing thread starvation on the HTTP serving layer.
4. **Modern Storage & Database:** Standardized on PostgreSQL 16 (Drizzle ORM) and MinIO S3-compatible object storage with direct presigned URLs.

---

## 3. Retained For Historical Reference

This directory is retained strictly for:
- Reference implementation of LaTeX compilation sandboxing and asset handling (`src/main/java/vn/edu/vnu/structpaper/compile/`).
- Prepress PDF validation logic (`src/main/java/vn/edu/vnu/structpaper/prepress/`).
- Historical database migrations (`src/main/resources/db/migration/`).

**Do NOT run, extend, or deploy this service.**
