# Postify

AI marketing/content platform. Built per the phased spec in `CLAUDE.md`.

## Status

**Scaffolding stage.** No product features exist yet. See `CLAUDE.md` for
the full spec, phase table, and working rules.

- Phase 0 (Audit) — done. Repo was empty at audit time; no legacy code to
  classify Keep/Refactor/Delete.
- Phase 1 (Foundation) — not started. Next up: auth, company profile,
  Creative DNA schema, Media Library, mobile-first shell.

## Stack

- **Next.js 15 (App Router, TypeScript)** — frontend and backend API
  (Route Handlers) in one deployable, per the spec's "avoid microservices"
  rule. Deploys anywhere Node runs; not locked to a specific host.
- **PostgreSQL + Prisma** — local dev via Docker Compose; any Postgres
  works in production.
- **Auth.js (self-hosted, credentials-based)** — no required third-party
  auth vendor, in line with the spec's free-first principle. Not yet
  wired up — that's Phase 1.
- **Tailwind CSS** — mobile-first styling. RTL/Arabic typography support
  is a Phase 1+ concern (system #3 in the spec), not yet configured.
- Background worker and object storage are intentionally not scaffolded
  yet — nothing in Phase 1 needs async jobs or external storage.

## Local setup

```bash
cp .env.example .env        # fill in DATABASE_URL / AUTH_SECRET
docker compose up -d        # starts local Postgres
npm install
npm run db:generate
npm run dev
```

## Structure

```
src/app/       Next.js App Router routes (frontend + API route handlers)
prisma/        Database schema (empty until Phase 1 adds models)
docker-compose.yml   Local Postgres for dev
```
