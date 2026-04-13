# ExamForge — QWEN.md

## Project Overview

**ExamForge** is a self-hosted, exam-oriented form platform built with **Next.js 16** (App Router). It enables administrators to create, manage, and conduct secure MCQ examinations with access control, time limits, full-screen enforcement, and email notifications via SMTP.

Unlike Google Forms, ExamForge is purpose-built for examinations with:
- One-time exam sessions per student (Gmail-based, no registration required)
- Full-screen enforcement with exit prevention
- Time limits with auto-submission
- Gmail-based access control per exam
- Admin-only management panel with JWT authentication
- Email notifications to students and admins via SMTP (Nodemailer)
- PostgreSQL database with Prisma ORM

### Key Architecture
- **Admin Panel** (`/admin/**`) — Dashboard for managing exams, questions, submissions, and access control
- **Exam Taking** (`/exam/[slug]`) — Public-facing exam interface for students
- **API Routes** — Split into `/api/admin/**` (JWT-protected) and `/api/exam/**` (session-token based)
- **Database** — PostgreSQL with Prisma ORM, using a comprehensive schema with 15+ models
- **Auth** — JWT access tokens + HTTP-only refresh token rotation
- **UI** — Shadcn UI (Radix primitives) + Tailwind CSS v4 + Lucide icons

### Tech Stack
| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.3 (App Router) |
| Language | TypeScript 5 (strict mode) |
| React | React 19.2.4 |
| Styling | Tailwind CSS v4, shadcn/ui |
| Database | PostgreSQL |
| ORM | Prisma 7.7.0 |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Validation | Zod v4 |
| Email | Nodemailer |
| State | Zustand |
| Drag & Drop | dnd-kit |
| Charts | Recharts |

## Directory Structure

```
examforge/
├── app/                          # Next.js App Router
│   ├── admin/                    # Admin panel pages
│   │   ├── dashboard/            # Admin dashboard (exams, settings)
│   │   ├── login/                # Admin login
│   │   ├── register/             # Admin registration (invite-only)
│   │   ├── forgot-password/      # Password recovery
│   │   ├── reset-password/       # Password reset
│   │   └── verify-email/         # Email verification
│   ├── api/                      # API routes
│   │   ├── admin/                # Admin API (JWT-protected)
│   │   └── exam/                 # Public exam API (session-token based)
│   ├── exam/                     # Public exam pages
│   │   └── [slug]/               # Exam entry, taking, and result
│   ├── layout.tsx                # Root layout (Geist fonts)
│   ├── page.tsx                  # Landing page
│   └── globals.css               # Tailwind + CSS variables theme
├── components/
│   ├── admin/                    # Admin-specific components
│   │   ├── AccessControl.tsx     # Exam access control UI
│   │   ├── AuthProvider.tsx      # Admin auth context
│   │   ├── DashboardNav.tsx      # Dashboard navigation
│   │   ├── ExamForm.tsx          # Exam creation/editing form
│   │   ├── QuestionEditor.tsx    # Question/option editor
│   │   └── SubmissionsTable.tsx  # Submissions list
│   ├── exam/                     # Exam-taking components
│   │   ├── ExamEntry.tsx         # Email verification entry
│   │   ├── ExamTimer.tsx         # Countdown timer
│   │   ├── FullscreenGuard.tsx   # Full-screen enforcement
│   │   ├── QuestionCard.tsx      # Question display
│   │   └── ResultCard.tsx        # Result display
│   └── ui/                       # Shadcn UI primitives (~60 components)
├── hooks/
│   └── use-mobile.ts             # Responsive breakpoint hook
├── lib/
│   ├── generated/prisma/         # Auto-generated Prisma client
│   ├── validators/               # Zod schemas (access, auth, exam)
│   ├── apiClient.ts              # Frontend API client with auto-refresh
│   ├── auth.ts                   # JWT sign/verify, token hashing
│   ├── withAdminAuth.ts          # Admin route handler wrapper
│   ├── withExamSession.ts        # Exam session handler wrapper
│   ├── prisma.ts                 # Prisma singleton (dev hot-reload safe)
│   ├── mailer.ts                 # Nodemailer configuration
│   ├── email-templates/          # Email template definitions
│   ├── audit.ts                  # Audit logging helpers
│   ├── rateLimit.ts              # Rate limiting middleware
│   ├── slugify.ts                # URL slug generation
│   └── utils.ts                  # cn() utility (clsx + tailwind-merge)
├── prisma/
│   ├── schema.prisma             # Database schema (15+ models)
│   ├── seed.ts                   # Seed script for super admin
│   └── migrations/               # Prisma migrations
└── public/                       # Static assets
```

## Building and Running

### Prerequisites
- Node.js 20+
- PostgreSQL database
- SMTP credentials (for email features)

### Environment Variables
Copy `.env.example` to `.env.local` and configure:
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — JWT signing keys
- `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` — Token expiry (default: `15m` / `7d`)
- SMTP settings for Nodemailer
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_NAME` — Initial admin account

### Setup Commands

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Seed the initial super admin
npm run db:seed

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run linter
npm run lint
```

## Development Conventions

### TypeScript
- **Strict mode** enabled (`strict: true` in tsconfig.json)
- **Path aliases**: `@/*` maps to project root (`"./*"`)
- All files use `.ts` / `.tsx` extensions
- Target: ES2017, module: ESNext, bundler resolution

### API Route Patterns
- **Admin routes** use `withAdminAuth()` wrapper for JWT verification — provides `adminId` in context
- **Exam routes** use `withExamSession()` wrapper for session validation
- Request validation uses **Zod schemas** in `lib/validators/`
- Tokens are stored as **SHA-256 hashes** in the database (never store raw tokens)

### Auth Flow
- Access tokens: short-lived JWT (default 15 min), passed via `Authorization: Bearer` header
- Refresh tokens: long-lived JWT (default 7 days), stored as HTTP-only cookies
- Token rotation on refresh — old refresh token is revoked, new pair issued
- Frontend `apiFetch()` in `lib/apiClient.ts` handles automatic 401 → refresh → retry

### Frontend API Client
- `apiFetch()` is the primary client for admin API calls
- Automatically handles JWT refresh on 401 responses
- Singleton in-flight refresh — concurrent 401s share one refresh call
- Access token stored in memory + cookie (not localStorage)

### UI Components
- Uses **shadcn/ui** with Radix primitives (`radix-nova` style)
- Tailwind CSS v4 with CSS custom properties for theming
- Dark mode support via `next-themes`
- `cn()` utility from `lib/utils.ts` for conditional class merging

### Database
- Prisma 7 with custom adapter (`@prisma/adapter-pg`) for PostgreSQL
- Custom output path: `lib/generated/prisma/`
- Dev-only Prisma client singleton to prevent multiple instances during hot reload
- 15+ models covering: admins, students, exams, questions, options, sessions, responses, access rules, email notifications, audit logs

### Key Business Rules
- **One session per student per exam** — enforced by unique constraint `(exam_form_id, student_id)`
- Students are auto-created on first exam access (Gmail only, no password)
- Admin accounts can only be created by existing admins (no public registration)
- Email verification required before admin access is granted
- Exam access can be `public_link` (anyone with link) or `specific_emails` (whitelist only)
