# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run lint         # Run ESLint
npm run db:generate  # Regenerate Prisma client after schema changes
npm run db:migrate   # Run migrations in development
npm run db:seed      # Seed the database (creates first admin via prisma/seed.ts)
```

The Prisma client is generated to `lib/generated/prisma/` (not the default location). Always run `db:generate` after changing `prisma/schema.prisma`.

## Architecture

HI Tech Examination is a self-hosted MCQ exam platform. **Admins** manage exams through a protected dashboard; **students** take exams via shareable links without accounts.

### Two distinct user roles

- **Admin** — JWT-authenticated (access + refresh tokens in HTTP-only cookies), email-verified, created only by existing admins (first admin via `db:seed`)
- **Student** — identified by Gmail only, auto-created on first exam access, no login/dashboard

### Route structure

```
app/
  admin/              # Admin auth pages (login, register, verify-email, forgot/reset password)
  admin/dashboard/    # Protected admin panel
    exams/[id]/       # Exam detail, questions, access rules, results
    settings/
  exam/[slug]/        # Public student-facing exam UI
  api/admin/          # Admin API routes (JWT-protected via withAdminAuth middleware)
  api/exam/[slug]/    # Student API routes (rate-limited, session-validated via withExamSession)
```

### Key middleware / utilities in `lib/`

- `withAdminAuth.ts` — wraps admin API route handlers; validates JWT access token
- `withExamSession.ts` — wraps student API route handlers; validates active exam session
- `auth.ts` — `signAccessToken`, `signRefreshToken`, `hashToken`
- `prisma.ts` — singleton Prisma client (import from here, not from the generated path directly)
- `rateLimit.ts` — in-memory rate limiting applied to student endpoints
- `validators/` — Zod schemas for all request bodies (never trust raw request data)

### Database

PostgreSQL via Prisma. Core models: `Admin`, `Student`, `ExamForm`, `ExamQuestion`, `ExamQuestionOption`, `ExamSession`, `ExamResponse`, `ExamAccessRule`, `RefreshToken`, `AuditLog`, `EmailNotification`.

One `ExamSession` per student per exam — enforces single-attempt rule. The session tracks proctoring events (`tabSwitchCount`, `fullscreenExitCount`) and has a heartbeat endpoint to detect abandonment.

### Exam session security

- Full-screen enforced on start; exits logged
- Tab/window switches detected and logged
- `beforeunload` triggers auto-submit warning
- Timer auto-submits on expiry; heartbeat detects abandoned sessions

### Email

Nodemailer over SMTP. Outgoing emails are queued in the `EmailNotification` table before dispatch. Templates live in `lib/email-templates/`.

## Environment variables required

```
DATABASE_URL
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
JWT_ACCESS_EXPIRES_IN
JWT_REFRESH_EXPIRES_IN
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASS
NEXT_PUBLIC_APP_URL
```

## Path aliases

`@/*` maps to the repository root (configured in `tsconfig.json`). Use `@/lib/...`, `@/components/...`, etc.
