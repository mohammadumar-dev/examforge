# HI Tech Examination

> A self-hosted, secure MCQ examination platform built with Next.js 16, PostgreSQL, and Prisma ORM.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16.2-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38B2AC)](https://tailwindcss.com/)

**HI Tech Examination** enables administrators to create, manage, and conduct secure MCQ examinations with access control, time limits, full-screen enforcement, and email notifications — all self-hosted. Unlike Google Forms, it is purpose-built for examinations.

![HI Tech Examination Hero](https://placehold.co/1200x400/1a1a2e/ffffff?text=HI Tech Examination+Banner)

---

## ✨ Features

### For Administrators

| Feature | Description |
|---|---|
| **JWT Authentication** | Secure login with access + refresh token rotation (HTTP-only cookies) |
| **Email Verification** | SMTP-based verification required before admin access is granted |
| **Password Recovery** | Forgot/reset password flow with token-based reset links |
| **Exam Builder** | Create MCQ exams with 4-option questions, drag-and-drop reordering |
| **Exam Settings** | Time limits, shuffle questions/options, passing score, scheduled start/end dates |
| **Access Control** | Public link (anyone with link) or specific Gmail whitelist per exam |
| **Publish Management** | Draft → Published → Closed lifecycle control |
| **Submissions Viewer** | View all student responses, per-student detailed results |
| **Analytics Dashboard** | Total attempts, average score, pass rate visualized with Recharts |
| **Audit Logging** | Track admin actions for accountability |
| **Email Notifications** | Receive submission notifications via SMTP (Nodemailer) |

### For Students

| Feature | Description |
|---|---|
| **No Registration Required** | Students identified by Gmail only, auto-created on first exam access |
| **One-Session Enforcement** | Each student can attempt an exam only once (DB-level unique constraint) |
| **Full-Screen Mode** | Enforced on exam start with exit prevention and logging |
| **Tab Switch Detection** | Detected, logged, and configurable warning thresholds |
| **Time Limits + Auto-Submit** | Countdown timer; exam auto-submits on expiry |
| **Exit Prevention** | `beforeunload` warning; auto-submit on close attempt |
| **Immediate Results** | Score displayed on submission (if enabled by admin) |
| **Email Confirmation** | Students receive acknowledgment/result emails via SMTP |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        Client                           │
│  ┌──────────────┐         ┌─────────────────────────┐   │
│  │  Admin Panel │         │   Exam Taking (Public)  │   │
│  │  /admin/**   │         │   /exam/[slug]          │   │
│  └──────┬───────┘         └──────────┬──────────────┘   │
└─────────┼────────────────────────────┼──────────────────┘
          │                            │
┌─────────┼────────────────────────────┼──────────────────┐
│         ▼        Next.js App Router  ▼                  │
│  ┌──────────────┐         ┌─────────────────────────┐   │
│  │  Admin API   │         │     Exam API            │   │
│  │  /api/admin/ │         │     /api/exam/          │   │
│  │  (JWT guard) │         │     (session token)     │   │
│  └──────┬───────┘         └──────────┬──────────────┘   │
│         │                            │                   │
│         └──────────────┬─────────────┘                   │
│                        ▼                                 │
│               ┌─────────────────┐                        │
│               │   Prisma ORM    │                        │
│               │   (PostgreSQL)  │                        │
│               └─────────────────┘                        │
│                                                          │
│  ┌──────────────────┐    ┌──────────────────────────┐   │
│  │  Nodemailer SMTP │    │  Rate Limiting / Audit   │   │
│  └──────────────────┘    └──────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16.2.3 (App Router) |
| **Language** | TypeScript 5 (strict mode) |
| **React** | React 19.2.4 |
| **Styling** | Tailwind CSS v4, shadcn/ui |
| **Database** | PostgreSQL |
| **ORM** | Prisma 7.7.0 |
| **Auth** | JWT (`jsonwebtoken`) + `bcryptjs` |
| **Validation** | Zod v4 |
| **Email** | Nodemailer |
| **State** | Zustand |
| **Drag & Drop** | dnd-kit |
| **Charts** | Recharts |
| **Icons** | Lucide React |
| **Notifications** | Sonner |

---

## 📂 Project Structure

```
examforge/
├── app/                          # Next.js App Router
│   ├── admin/                    # Admin panel pages
│   │   ├── dashboard/            # Dashboard (exams, settings)
│   │   ├── login/                # Admin login
│   │   ├── register/             # Admin registration (invite-only)
│   │   ├── forgot-password/      # Password recovery
│   │   ├── reset-password/       # Password reset
│   │   └── verify-email/         # Email verification
│   ├── api/                      # API route handlers
│   │   ├── admin/                # Admin API (JWT-protected via withAdminAuth)
│   │   └── exam/                 # Public exam API (session-validated via withExamSession)
│   ├── exam/[slug]/              # Public exam entry, taking, and result
│   ├── layout.tsx                # Root layout (Geist fonts)
│   ├── page.tsx                  # Landing page
│   └── globals.css               # Tailwind v4 + CSS variable theme
├── components/
│   ├── admin/                    # Admin-specific components
│   │   ├── AccessControl.tsx     # Exam access rule configuration
│   │   ├── AuthProvider.tsx      # Admin auth context provider
│   │   ├── DashboardNav.tsx      # Dashboard navigation sidebar
│   │   ├── ExamForm.tsx          # Exam creation/editing form
│   │   ├── QuestionEditor.tsx    # Question & option editor (dnd-kit)
│   │   └── SubmissionsTable.tsx  # Submissions list viewer
│   ├── exam/                     # Exam-taking components
│   │   ├── ExamEntry.tsx         # Gmail verification entry
│   │   ├── ExamTimer.tsx         # Countdown timer display
│   │   ├── FullscreenGuard.tsx   # Full-screen enforcement
│   │   ├── QuestionCard.tsx      # Question display & option selection
│   │   └── ResultCard.tsx        # Score result display
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
│   ├── mailer.ts                 # Nodemailer transporter configuration
│   ├── email-templates/          # HTML email template definitions
│   ├── audit.ts                  # Audit logging helpers
│   ├── rateLimit.ts              # In-memory rate limiting middleware
│   ├── slugify.ts                # URL slug generation utility
│   └── utils.ts                  # cn() utility (clsx + tailwind-merge)
├── prisma/
│   ├── schema.prisma             # Database schema (15+ models)
│   ├── seed.ts                   # Seed script for initial super admin
│   └── migrations/               # Prisma SQL migrations
└── public/                       # Static assets
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 20+
- **PostgreSQL** 14+ (running and accessible)
- **SMTP credentials** (Gmail App Password, SendGrid, etc. — for email features)

### 1. Clone & Install

```bash
git clone https://github.com/your-username/examforge.git
cd examforge
npm install
```

### 2. Configure Environment

Copy the example environment file and fill in your values:

```bash
cp .env.example .env.local
```

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/examforge` |
| `JWT_ACCESS_SECRET` | JWT access token signing key (≥32 chars) | `your_super_secret_key_32_chars_min` |
| `JWT_REFRESH_SECRET` | JWT refresh token signing key (≥32 chars) | `another_super_secret_key_32_chars` |
| `JWT_ACCESS_EXPIRES_IN` | Access token expiry | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiry | `7d` |
| `SMTP_HOST` | SMTP server host | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_USER` | SMTP username | `you@gmail.com` |
| `SMTP_PASS` | SMTP password (App Password for Gmail) | `abcd efgh ijkl mnop` |
| `NEXT_PUBLIC_APP_URL` | Public app URL | `http://localhost:3000` |
| `SEED_ADMIN_EMAIL` | Initial super admin email | `admin@yourdomain.com` |
| `SEED_ADMIN_PASSWORD` | Initial super admin password | `ChangeMe@123` |
| `SEED_ADMIN_NAME` | Initial super admin display name | `Super Admin` |

### 3. Set Up Database

```bash
# Generate Prisma client (output: lib/generated/prisma/)
npm run db:generate

# Run pending migrations
npm run db:migrate

# Seed the initial super admin account
npm run db:seed
```

### 4. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Production Build

```bash
npm run build     # Compile for production
npm run start     # Start production server
```

---

## 📋 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Production build (optimized) |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Regenerate Prisma client after schema changes |
| `npm run db:migrate` | Run database migrations (development) |
| `npm run db:seed` | Seed database (creates super admin via `prisma/seed.ts`) |

---

## 🔐 Security Model

### Authentication

- **Admin** — JWT access tokens (short-lived, default 15 min) passed via `Authorization: Bearer` header. Refresh tokens (long-lived, default 7 days) stored as **SHA-256 hashes** in HTTP-only, `SameSite=Strict`, `Secure` cookies. Token rotation on every refresh — old tokens are revoked.
- **Student** — Session tokens (UUID) stored in `sessionStorage` (never `localStorage`). Validated server-side on every protected API call.

### Exam Session Security

| Mechanism | Implementation |
|---|---|
| **One session per student** | DB unique constraint `(exam_form_id, student_id)` |
| **Full-screen enforcement** | `requestFullscreen()` API; exit events logged + warnings triggered |
| **Tab/visibility detection** | `visibilitychange` listener logs switches via heartbeat API |
| **Exit prevention** | `beforeunload` dialog triggers auto-save + warning |
| **Time limit auto-submit** | Client countdown + server-side heartbeat force-submits on expiry |
| **Rate limiting** | In-memory rate limiter on student-facing endpoints |
| **Token hashing** | All tokens (refresh, email verify, password reset) stored as SHA-256 hashes |

### Data Validation

- All API inputs validated with **Zod v4** schemas in `lib/validators/`
- Prisma parameterized queries prevent SQL injection
- Sensitive fields (`passwordHash`, `tokenHash`) never exposed in API responses
- Email addresses normalized to lowercase before storage

---

## 🗄 Database

### Models (15+)

| Model | Purpose |
|---|---|
| `Admin` | Admin accounts (invite-only, email-verified) |
| `Student` | Auto-created student records (Gmail-based, no password) |
| `ExamForm` | Exam definition, settings, scheduling, publishing |
| `ExamQuestion` | Questions belonging to an exam |
| `ExamQuestionOption` | Answer options per question |
| `ExamSession` | One session per student per exam with security tracking |
| `ExamResponse` | Student's response per question |
| `ExamResponseOption` | Selected options per response (multi-choice support) |
| `ExamAccessRule` | Access type per exam (`public_link` or `specific_emails`) |
| `ExamAllowedEmail` | Whitelisted emails for restricted-access exams |
| `RefreshToken` | JWT refresh token store (rotation-based, revocable) |
| `EmailNotification` | Outbound email queue log (pending → sent/failed) |
| `AuditLog` | Admin action audit trail |

### Schema Location

- **Source:** `prisma/schema.prisma`
- **Generated client:** `lib/generated/prisma/` (custom output path)
- **Client import:** Always import from `@/lib/prisma` (singleton, dev hot-reload safe)

---

## 📧 Email System

Powered by **Nodemailer** over SMTP. Emails are queued in the `EmailNotification` table before dispatch with automatic retry (up to 3 attempts).

| Event | Recipient | Purpose |
|---|---|---|
| Admin registered | New admin | Email verification link |
| Admin forgot password | Admin | Password reset link |
| Exam published (specific emails) | Allowed students | Exam invitation with link |
| Student submits exam | Student | Score / result confirmation |
| Student submits exam | Admin (exam owner) | New submission notification |

Email templates are defined in `lib/email-templates/`.

---

## 🌐 API Routes

### Admin API (`/api/admin/*`) — JWT-Protected

| Method | Route | Description |
|---|---|---|
| `POST` | `/auth/register` | Create admin (by existing admin) |
| `POST` | `/auth/login` | Login → access token + refresh cookie |
| `POST` | `/auth/logout` | Revoke refresh token |
| `POST` | `/auth/refresh` | Rotate refresh token |
| `POST` | `/auth/verify-email` | Verify email token |
| `POST` | `/auth/forgot-password` | Send password reset email |
| `POST` | `/auth/reset-password` | Reset password with token |
| `GET` | `/me` | Current admin profile |
| `GET/POST` | `/exams` | List / create exams |
| `GET/PATCH/DELETE` | `/exams/[id]` | Read / update / archive exam |
| `PATCH` | `/exams/[id]/publish` | Toggle published state |
| `CRUD` | `/exams/[id]/questions` | Manage questions & options |
| `PATCH` | `/exams/[id]/questions/reorder` | Reorder questions |
| `GET/PATCH` | `/exams/[id]/access` | Manage access rules |
| `POST/DELETE` | `/exams/[id]/access/emails` | Manage allowed emails |
| `GET` | `/exams/[id]/submissions` | List all submissions |
| `GET` | `/exams/[id]/analytics` | Pass rate, average score stats |

### Exam API (`/api/exam/*`) — Session-Token Based

| Method | Route | Description |
|---|---|---|
| `GET` | `[slug]` | Get exam info (if published & within schedule) |
| `POST` | `[slug]/verify-access` | Validate Gmail → create/return session |
| `GET` | `[slug]/questions` | Get questions (requires session token) |
| `POST` | `[slug]/response` | Save answer for one question |
| `POST` | `[slug]/submit` | Finalize exam, calculate score, send emails |
| `POST` | `[slug]/heartbeat` | Update security counters, check expiry |
| `GET` | `[slug]/result/[sessionId]` | Fetch result after submission |

---

## 🎨 UI Components

Built with **shadcn/ui** (Radix primitives) and **Tailwind CSS v4**.

| Category | Components |
|---|---|
| **Form** | Button, Input, Label, Textarea, Select, Checkbox, RadioGroup, Switch, Calendar, Form |
| **Overlay** | Dialog, Alert, Toast (Sonner), Tooltip, Popover, Dropdown Menu, Context Menu, Sheet, Drawer |
| **Navigation** | Tabs, Breadcrumb, Pagination, Command Palette (cmdk) |
| **Layout** | Card, Separator, Scroll Area, Resizable Panels, Carousel |
| **Data** | Table, Badge, Progress, Chart (Recharts) |
| **Feedback** | Skeleton, Spinner, Avatar |

Dark mode supported via `next-themes`. The `cn()` utility from `@/lib/utils` handles conditional class merging (`clsx` + `tailwind-merge`).

---

## 🧑‍💻 Development Conventions

### TypeScript

- Strict mode enabled (`strict: true`)
- Path alias: `@/*` → project root
- Target: ES2017, module: ESNext

### API Patterns

- Admin routes wrapped with `withAdminAuth()` — provides `adminId` in context
- Exam routes wrapped with `withExamSession()` — validates active session
- Request bodies validated with Zod schemas in `lib/validators/`

### Auth Flow

1. Login → server issues access token (15 min) + sets refresh token cookie (7 days)
2. Access token passed via `Authorization: Bearer` header
3. On 401: `apiFetch()` in `@/lib/apiClient.ts` automatically refreshes (singleton in-flight — concurrent 401s share one refresh call)
4. On refresh: old token revoked, new pair issued (rotation)

### Frontend API Client

```typescript
import { apiFetch } from "@/lib/apiClient";

// Example: create an exam
const response = await apiFetch("/api/admin/exams", {
  method: "POST",
  body: JSON.stringify({ title: "Midterm 2026", timeLimitMinutes: 60 }),
});
```

---

## 🗺 Roadmap

- [ ] Multiple-choice question scoring (partial credit)
- [ ] Bulk student import via CSV
- [ ] Exam result export (CSV/PDF)
- [ ] Admin role-based permissions (editor vs viewer)
- [ ] IP-based access restrictions
- [ ] Browser lockdown integration (Respondus, Safe Exam Browser)
- [ ] Multi-language support (i18n)
- [ ] Docker deployment configuration
- [ ] Automated email queue processor (cron / `waitUntil`)

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📬 Support

For issues, questions, or suggestions, please [open an issue](https://github.com/your-username/examforge/issues) on GitHub.

---

Built with ❤️ using Next.js, Prisma, and PostgreSQL.
