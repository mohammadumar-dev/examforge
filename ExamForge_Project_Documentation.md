# HI Tech Examination — Examination Platform
### Full-Stack Project Documentation
> **Stack:** Next.js 14 (App Router) · PostgreSQL · Prisma ORM · Shadcn UI · SMTP (Nodemailer)
> **Version:** MVP 1.0 | **Last Updated:** April 2026

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Roles & Access Model](#2-roles--access-model)
3. [Feature List (MVP)](#3-feature-list-mvp)
4. [Architecture Overview](#4-architecture-overview)
5. [Production Database Design](#5-production-database-design)
6. [API Route Structure](#6-api-route-structure)
7. [Email & Notification System](#7-email--notification-system)
8. [Exam Session Security](#8-exam-session-security)
9. [Environment Variables](#9-environment-variables)
10. [Folder Structure](#10-folder-structure)
11. [MVP Development Roadmap](#11-mvp-development-roadmap)
12. [Claude Code Prompting Guide](#12-claude-code-prompting-guide)

---

## 1. Project Overview

**HI Tech Examination** is a self-hosted, exam-oriented form platform built for administrators who need to conduct secure, shareable, and access-controlled MCQ examinations. Unlike Google Forms, HI Tech Examination is built specifically for examinations with:

- One-time exam sessions per student email
- Full-screen enforcement with exit prevention
- Time limits with auto-submission
- Gmail-based access control per exam
- Admin-only management panel
- Email notifications to students and admins via SMTP

There is **no student dashboard**. Students only interact with the exam via a shared link. Admins manage everything through a dedicated admin panel.

---

## 2. Roles & Access Model

### Admin
- Created only by an existing admin (no public registration)
- First admin is seeded via a CLI script or migration seed
- Can register new admins, manage exams, view results
- Must verify email via SMTP before access is granted
- Has login, forgot password, and reset password flows
- Uses JWT access tokens + refresh tokens (HTTP-only cookies)

### Student (User)
- Not a registered user — identified only by their **Gmail address**
- Auto-created in the `students` table upon first exam access
- No login, no dashboard, no password
- Accesses exams via a shareable link
- Must provide their Gmail which is validated against the exam's allowed access list

---

## 3. Feature List (MVP)

### Admin Features
| Feature | Description |
|---|---|
| Admin Registration | Invite-only, created by existing admin |
| Email Verification | SMTP OTP/token sent on registration |
| Admin Login | JWT-based with refresh token rotation |
| Forgot Password | SMTP reset link with expiry |
| Reset Password | Token-validated, history tracked |
| Create Exam | Title, instructions, time limit, start/end schedule |
| Add Questions | MCQ with 4 options, mark correct answer(s) |
| Reorder Questions | Drag-and-drop order management |
| Shuffle Settings | Toggle shuffle questions / shuffle options per exam |
| Access Control | Set exam to public link or specific Gmail list |
| Publish/Unpublish Exam | Draft vs Live toggle |
| View Submissions | See all student responses per exam |
| View Per-Student Result | Score, time taken, answers given |
| Email Notifications | Notify students on exam invite; notify admin on submission |
| Exam Analytics | Total attempts, average score, pass rate |

### Student/Exam Features
| Feature | Description |
|---|---|
| Exam Access via Link | Unique shareable URL per exam |
| Gmail Verification | Student enters Gmail; validated against allowed list |
| One Session Enforcement | Same Gmail cannot re-enter the same exam |
| Full-Screen Mode | Enforced on exam start, browser API |
| Exit Prevention | Beforeunload warning; auto-submit if they try to close |
| Tab Switch Detection | Detected and logged; configurable warning count |
| Time Limit with Auto-Submit | Countdown timer; auto-submits on expiry |
| Question Navigation | Next/Prev with answer save per question |
| Review Before Submit | See unanswered count before final submit |
| Result on Submission | Immediate score display (if enabled by admin) |
| Email on Submission | Student receives result/acknowledgment email |

---

## 4. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                        Client                           │
│  ┌──────────────┐         ┌─────────────────────────┐   │
│  │  Admin Panel │         │   Exam Taking (Public)  │   │
│  │  /admin/**   │         │   /exam/[slug]          │   │
│  └──────┬───────┘         └──────────┬──────────────┘   │
└─────────┼──────────────────────────-─┼──────────────────┘
          │                            │
┌─────────┼────────────────────────────┼──────────────────┐
│         ▼        Next.js App Router  ▼                  │
│  ┌──────────────┐         ┌─────────────────────────┐   │
│  │  Admin API   │         │     Exam API            │   │
│  │  /api/admin/ │         │     /api/exam/          │   │
│  └──────┬───────┘         └──────────┬──────────────┘   │
│         │           Middleware       │                   │
│         │    (JWT Auth / Rate Limit) │                   │
│         └──────────────┬────────────┘                   │
│                        ▼                                │
│               ┌─────────────────┐                       │
│               │   Prisma ORM    │                       │
│               └────────┬────────┘                       │
│                        ▼                                │
│               ┌─────────────────┐                       │
│               │   PostgreSQL    │                       │
│               └─────────────────┘                       │
│                                                         │
│               ┌─────────────────┐                       │
│               │ Nodemailer SMTP │  (Notifications)      │
│               └─────────────────┘                       │
└─────────────────────────────────────────────────────────┘
```

### Technology Decisions
| Concern | Choice | Reason |
|---|---|---|
| Framework | Next.js 14 App Router | SSR + API routes in one project |
| Database | PostgreSQL | Relational, reliable, JSONB support |
| ORM | Prisma | Type-safe, migrations, great DX |
| Auth | JWT + HttpOnly Cookies | Stateless + CSRF-safe |
| UI | Shadcn UI + Tailwind | Accessible, customizable |
| Email | Nodemailer (SMTP) | Works with Gmail, SendGrid, etc. |
| Validation | Zod | Runtime + compile-time safe |
| State | Zustand (client) | Lightweight exam state management |

---

## 5. Production Database Design

### 5.1 Schema Overview

```
admins ──< email_verification_tokens
admins ──< password_reset_tokens
admins ──< password_reset_history
admins ──< refresh_tokens
admins ──< exam_forms

exam_forms ──< exam_questions
exam_questions ──< exam_question_options

exam_forms ──< exam_access_rules
exam_access_rules ──< exam_allowed_emails

exam_forms ──< exam_sessions
students ──< exam_sessions
exam_sessions ──< exam_responses
exam_responses ──< exam_response_options

admins ──< email_notifications
students ──< email_notifications
```

---

### 5.2 Full Table Definitions (SQL)

```sql
-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ADMINS
-- ============================================================
CREATE TABLE admins (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                VARCHAR(120)    NOT NULL,
  email               VARCHAR(255)    NOT NULL UNIQUE,
  password_hash       TEXT            NOT NULL,
  role                VARCHAR(20)     NOT NULL DEFAULT 'admin'
                        CHECK (role IN ('super_admin', 'admin')),
  is_active           BOOLEAN         NOT NULL DEFAULT false,   -- true after email verification
  is_email_verified   BOOLEAN         NOT NULL DEFAULT false,
  created_by_admin_id UUID            REFERENCES admins(id) ON DELETE SET NULL,
  last_login_at       TIMESTAMPTZ,
  last_login_ip       INET,
  created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admins_email ON admins(email);

-- ============================================================
-- EMAIL VERIFICATION TOKENS (for admin registration)
-- ============================================================
CREATE TABLE email_verification_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID         NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  token_hash  TEXT         NOT NULL UNIQUE,   -- SHA-256 hash of the raw token
  expires_at  TIMESTAMPTZ  NOT NULL,
  used_at     TIMESTAMPTZ,                    -- NULL = not yet used
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_verification_admin ON email_verification_tokens(admin_id);
CREATE INDEX idx_email_verification_expires ON email_verification_tokens(expires_at);

-- ============================================================
-- PASSWORD RESET TOKENS
-- ============================================================
CREATE TABLE password_reset_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID         NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  token_hash  TEXT         NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ  NOT NULL,
  used_at     TIMESTAMPTZ,
  requested_ip INET,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_password_reset_admin ON password_reset_tokens(admin_id);

-- ============================================================
-- PASSWORD RESET HISTORY (audit log)
-- ============================================================
CREATE TABLE password_reset_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID         NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  reset_ip    INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- REFRESH TOKENS (JWT refresh token store)
-- ============================================================
CREATE TABLE refresh_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id     UUID         NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  token_hash   TEXT         NOT NULL UNIQUE,   -- SHA-256 of raw token
  expires_at   TIMESTAMPTZ  NOT NULL,
  revoked_at   TIMESTAMPTZ,                    -- NULL = still valid
  ip_address   INET,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_admin ON refresh_tokens(admin_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- ============================================================
-- STUDENTS (auto-created on first exam access)
-- ============================================================
CREATE TABLE students (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       VARCHAR(255) NOT NULL UNIQUE,    -- Gmail address (normalized lowercase)
  name        VARCHAR(120),                    -- optional, collected on exam entry
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_students_email ON students(email);

-- ============================================================
-- EXAM FORMS
-- ============================================================
CREATE TABLE exam_forms (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id              UUID            NOT NULL REFERENCES admins(id) ON DELETE RESTRICT,
  title                 VARCHAR(255)    NOT NULL,
  slug                  VARCHAR(255)    NOT NULL UNIQUE,   -- URL-safe unique identifier
  description           TEXT,
  instructions          TEXT,
  time_limit_minutes    INTEGER         CHECK (time_limit_minutes > 0),  -- NULL = no time limit
  scheduled_start_at    TIMESTAMPTZ,    -- NULL = available immediately when published
  scheduled_end_at      TIMESTAMPTZ,    -- NULL = no end date
  passing_score_percent INTEGER         NOT NULL DEFAULT 0
                          CHECK (passing_score_percent BETWEEN 0 AND 100),
  total_marks           INTEGER         NOT NULL DEFAULT 0,   -- computed/cached
  shuffle_questions     BOOLEAN         NOT NULL DEFAULT false,
  shuffle_options       BOOLEAN         NOT NULL DEFAULT false,
  show_result_immediately BOOLEAN       NOT NULL DEFAULT true,
  allow_review_answers  BOOLEAN         NOT NULL DEFAULT false,
  is_published          BOOLEAN         NOT NULL DEFAULT false,
  max_attempts          INTEGER         NOT NULL DEFAULT 1,   -- MVP: always 1
  status                VARCHAR(20)     NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'published', 'closed', 'archived')),
  created_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_exam_forms_admin ON exam_forms(admin_id);
CREATE INDEX idx_exam_forms_slug ON exam_forms(slug);
CREATE INDEX idx_exam_forms_status ON exam_forms(status);

-- ============================================================
-- EXAM QUESTIONS
-- ============================================================
CREATE TABLE exam_questions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_form_id     UUID         NOT NULL REFERENCES exam_forms(id) ON DELETE CASCADE,
  question_text    TEXT         NOT NULL,
  question_type    VARCHAR(20)  NOT NULL DEFAULT 'single_choice'
                     CHECK (question_type IN ('single_choice', 'multiple_choice')),
  marks            NUMERIC(5,2) NOT NULL DEFAULT 1,
  order_index      INTEGER      NOT NULL DEFAULT 0,   -- for manual ordering
  explanation      TEXT,                              -- shown after exam if review enabled
  is_required      BOOLEAN      NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (exam_form_id, order_index)
);

CREATE INDEX idx_exam_questions_form ON exam_questions(exam_form_id);

-- ============================================================
-- EXAM QUESTION OPTIONS
-- ============================================================
CREATE TABLE exam_question_options (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id   UUID         NOT NULL REFERENCES exam_questions(id) ON DELETE CASCADE,
  option_text   TEXT         NOT NULL,
  is_correct    BOOLEAN      NOT NULL DEFAULT false,
  order_index   INTEGER      NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_exam_options_question ON exam_question_options(question_id);

-- ============================================================
-- EXAM ACCESS RULES (per exam)
-- ============================================================
CREATE TABLE exam_access_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_form_id  UUID         NOT NULL REFERENCES exam_forms(id) ON DELETE CASCADE UNIQUE,
  access_type   VARCHAR(20)  NOT NULL DEFAULT 'specific_emails'
                  CHECK (access_type IN ('public_link', 'specific_emails')),
  -- public_link: anyone with the link can attempt (still one-session per email)
  -- specific_emails: only listed emails can attempt
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- EXAM ALLOWED EMAILS (used when access_type = 'specific_emails')
-- ============================================================
CREATE TABLE exam_allowed_emails (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_form_id  UUID         NOT NULL REFERENCES exam_forms(id) ON DELETE CASCADE,
  email         VARCHAR(255) NOT NULL,
  invited_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  invite_sent_at TIMESTAMPTZ,    -- when the invite email was dispatched
  UNIQUE (exam_form_id, email)
);

CREATE INDEX idx_allowed_emails_form ON exam_allowed_emails(exam_form_id);
CREATE INDEX idx_allowed_emails_email ON exam_allowed_emails(email);

-- ============================================================
-- EXAM SESSIONS (one per student per exam)
-- ============================================================
CREATE TABLE exam_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_form_id        UUID            NOT NULL REFERENCES exam_forms(id) ON DELETE RESTRICT,
  student_id          UUID            NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  status              VARCHAR(20)     NOT NULL DEFAULT 'in_progress'
                        CHECK (status IN ('in_progress', 'submitted', 'auto_submitted', 'expired')),
  started_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  submitted_at        TIMESTAMPTZ,
  time_taken_seconds  INTEGER,       -- computed on submit
  score               NUMERIC(6,2),  -- calculated on submit
  total_marks         NUMERIC(6,2),  -- snapshot of exam total_marks at time of attempt
  percentage          NUMERIC(5,2),  -- score / total_marks * 100
  is_passed           BOOLEAN,       -- based on passing_score_percent
  -- Security tracking
  ip_address          INET,
  user_agent          TEXT,
  tab_switch_count    INTEGER         NOT NULL DEFAULT 0,
  fullscreen_exit_count INTEGER       NOT NULL DEFAULT 0,
  -- One session enforcement
  session_token       TEXT            NOT NULL UNIQUE,  -- short-lived token stored in sessionStorage
  created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  UNIQUE (exam_form_id, student_id)   -- enforce one attempt per student per exam
);

CREATE INDEX idx_exam_sessions_form ON exam_sessions(exam_form_id);
CREATE INDEX idx_exam_sessions_student ON exam_sessions(student_id);
CREATE INDEX idx_exam_sessions_status ON exam_sessions(status);
CREATE INDEX idx_exam_sessions_token ON exam_sessions(session_token);

-- ============================================================
-- EXAM RESPONSES (one per question per session)
-- ============================================================
CREATE TABLE exam_responses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID         NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  question_id  UUID         NOT NULL REFERENCES exam_questions(id) ON DELETE CASCADE,
  is_skipped   BOOLEAN      NOT NULL DEFAULT false,
  is_correct   BOOLEAN,     -- computed on submit
  marks_awarded NUMERIC(5,2),
  answered_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, question_id)
);

CREATE INDEX idx_exam_responses_session ON exam_responses(session_id);

-- ============================================================
-- EXAM RESPONSE SELECTED OPTIONS
-- (separate table to support multiple_choice questions)
-- ============================================================
CREATE TABLE exam_response_options (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID  NOT NULL REFERENCES exam_responses(id) ON DELETE CASCADE,
  option_id   UUID  NOT NULL REFERENCES exam_question_options(id) ON DELETE CASCADE,
  UNIQUE (response_id, option_id)
);

CREATE INDEX idx_response_options_response ON exam_response_options(response_id);

-- ============================================================
-- EMAIL NOTIFICATIONS (outbound log)
-- ============================================================
CREATE TABLE email_notifications (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_type   VARCHAR(10)  NOT NULL CHECK (recipient_type IN ('admin', 'student')),
  recipient_id     UUID         NOT NULL,     -- admin.id or student.id (polymorphic ref)
  recipient_email  VARCHAR(255) NOT NULL,
  notification_type VARCHAR(50) NOT NULL,
  -- e.g. 'admin_email_verification', 'admin_password_reset',
  --      'student_exam_invite', 'student_exam_result', 'admin_new_submission'
  subject          TEXT         NOT NULL,
  body_html        TEXT,
  status           VARCHAR(10)  NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'sent', 'failed')),
  attempts         INTEGER      NOT NULL DEFAULT 0,
  sent_at          TIMESTAMPTZ,
  failed_reason    TEXT,
  related_exam_id  UUID         REFERENCES exam_forms(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_recipient ON email_notifications(recipient_type, recipient_id);
CREATE INDEX idx_notifications_status ON email_notifications(status);
CREATE INDEX idx_notifications_exam ON email_notifications(related_exam_id);

-- ============================================================
-- AUDIT LOG (optional but recommended for production)
-- ============================================================
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type  VARCHAR(10)  NOT NULL CHECK (actor_type IN ('admin', 'system')),
  actor_id    UUID,
  action      VARCHAR(100) NOT NULL,   -- e.g. 'exam.created', 'admin.password_reset'
  target_type VARCHAR(50),
  target_id   UUID,
  metadata    JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_actor ON audit_logs(actor_type, actor_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_created ON audit_logs(created_at);
```

---

### 5.3 Table Summary

| Table | Purpose |
|---|---|
| `admins` | Admin accounts (created by other admins) |
| `email_verification_tokens` | Email verification for admin registration |
| `password_reset_tokens` | Secure password reset links |
| `password_reset_history` | Audit trail of password changes |
| `refresh_tokens` | JWT refresh token store (rotation-based) |
| `students` | Auto-created student records (Gmail-based) |
| `exam_forms` | Exam definition, settings, scheduling |
| `exam_questions` | Questions belonging to an exam |
| `exam_question_options` | Answer options per question |
| `exam_access_rules` | Access type per exam (public/specific) |
| `exam_allowed_emails` | Whitelisted emails for specific-access exams |
| `exam_sessions` | One session per student per exam |
| `exam_responses` | Student's response per question |
| `exam_response_options` | Selected options per response (multi-choice support) |
| `email_notifications` | Outbound email log |
| `audit_logs` | Admin action audit trail |

---

## 6. API Route Structure

```
/api
├── /admin
│   ├── POST   /auth/register          # Create admin (by existing admin)
│   ├── POST   /auth/verify-email      # Verify email token
│   ├── POST   /auth/login             # Login → access + refresh token
│   ├── POST   /auth/logout            # Revoke refresh token
│   ├── POST   /auth/refresh           # Rotate refresh token
│   ├── POST   /auth/forgot-password   # Send reset email
│   └── POST   /auth/reset-password    # Reset with token
│
├── /admin (protected — requires valid JWT)
│   ├── GET    /me                     # Current admin profile
│   ├── PATCH  /me                     # Update profile
│   │
│   ├── GET    /exams                  # List all exams
│   ├── POST   /exams                  # Create exam
│   ├── GET    /exams/[id]             # Get exam with questions
│   ├── PATCH  /exams/[id]             # Update exam settings
│   ├── DELETE /exams/[id]             # Archive exam
│   ├── PATCH  /exams/[id]/publish     # Publish / unpublish
│   │
│   ├── POST   /exams/[id]/questions          # Add question
│   ├── PATCH  /exams/[id]/questions/[qid]   # Update question
│   ├── DELETE /exams/[id]/questions/[qid]   # Delete question
│   ├── PATCH  /exams/[id]/questions/reorder # Reorder questions
│   │
│   ├── GET    /exams/[id]/access             # Get access rules
│   ├── PATCH  /exams/[id]/access             # Update access type
│   ├── POST   /exams/[id]/access/emails      # Add allowed emails (bulk)
│   ├── DELETE /exams/[id]/access/emails/[email] # Remove email
│   ├── POST   /exams/[id]/access/invite      # Send invite emails
│   │
│   ├── GET    /exams/[id]/submissions        # All submissions
│   ├── GET    /exams/[id]/submissions/[sid]  # Single submission detail
│   └── GET    /exams/[id]/analytics          # Pass rate, avg score etc.
│
└── /exam (public — no auth, session-token based)
    ├── GET    /[slug]                 # Get exam info (title, instructions)
    ├── POST   /[slug]/verify-access   # Submit Gmail → validate → create/return session
    ├── GET    /[slug]/questions       # Get questions (requires session token)
    ├── POST   /[slug]/response        # Save answer per question
    ├── POST   /[slug]/submit          # Final submit
    ├── POST   /[slug]/heartbeat       # Keep session alive + log tab switches
    └── GET    /[slug]/result/[sessionId]  # Fetch result after submit
```

---

## 7. Email & Notification System

### SMTP Configuration (Nodemailer)

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your@gmail.com
SMTP_PASS=app_password_here
SMTP_FROM="HI Tech Examination <your@gmail.com>"
```

### Notification Triggers

| Event | Recipients | Template |
|---|---|---|
| Admin registered | Admin (new) | Email verification link |
| Admin forgot password | Admin | Password reset link |
| Exam published (with specific emails) | All allowed students | Exam invite with link |
| Student completes exam | Student | Score / result summary |
| Student completes exam | Admin (exam owner) | New submission notification |
| Exam closing soon (scheduled end) | Admin | Exam expiry reminder |

### Email Queue Strategy (MVP)
- All emails are logged to the `email_notifications` table with `status = 'pending'`
- A background function (Next.js Route Handler with `waitUntil` or a cron) processes pending emails
- On success: update `status = 'sent'`, set `sent_at`
- On failure: increment `attempts`, set `failed_reason`; retry up to 3 times

---

## 8. Exam Session Security

### One-Session-Per-Email Enforcement

1. Student submits their Gmail on exam entry
2. Server checks `exam_sessions` table for `(exam_form_id, student_id)` unique pair
3. If a session already exists in any status → **access denied**, show "You have already attempted this exam"
4. If no session exists → create new session, return `session_token` (UUID stored in sessionStorage)
5. All subsequent API calls from the exam page must include the `session_token` in headers
6. Server validates `session_token` matches an `in_progress` session

### Full-Screen Enforcement

```javascript
// On exam start — request full screen
document.documentElement.requestFullscreen();

// Detect full-screen exit
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) {
    // Log exit via /api/exam/[slug]/heartbeat
    // Show warning overlay
    // Increment fullscreen_exit_count in DB
    // After N exits (configurable) → auto-submit
  }
});
```

### Tab Switch / Focus Detection

```javascript
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Log tab switch via heartbeat API
    // Increment tab_switch_count in DB
    // Show warning to student
  }
});
```

### Exit / Close Prevention

```javascript
window.addEventListener('beforeunload', (e) => {
  // Triggers native browser "Leave site?" dialog
  e.preventDefault();
  e.returnValue = '';
  // Also trigger auto-save of current answers
});
```

### Auto-Submit on Time Expiry

- Client: countdown timer reaches 0 → call `/api/exam/[slug]/submit`
- Server: heartbeat endpoint checks if `started_at + time_limit_minutes < NOW()` → force-submit with status `auto_submitted`
- Server-side guard ensures a session cannot be in `in_progress` past its expiry

### Access Validation Flow

```
Student opens /exam/[slug]
        │
        ▼
Is exam published & within scheduled window?  ──No──► 404 / "Exam not available"
        │ Yes
        ▼
Student enters Gmail
        │
        ▼
access_type = 'specific_emails'?
  ├── Yes → Is email in exam_allowed_emails?  ──No──► "You are not authorized for this exam"
  └── No (public_link) → continue
        │
        ▼
Does exam_sessions row exist for (exam_form_id, student_id)?
  ├── status = 'submitted'/'auto_submitted' → "Already attempted"
  └── status = 'in_progress' → resume session (return existing session_token)
  └── no row → create session, return session_token
```

---

## 9. Environment Variables

```bash
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/examforge

# JWT
JWT_ACCESS_SECRET=your_access_secret_min_32_chars
JWT_REFRESH_SECRET=your_refresh_secret_min_32_chars
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=you@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM="HI Tech Examination <you@gmail.com>"

# Seeding (first super_admin)
SEED_ADMIN_EMAIL=admin@yourdomain.com
SEED_ADMIN_PASSWORD=ChangeMe@123
SEED_ADMIN_NAME=Super Admin
```

---

## 10. Folder Structure

```
examforge/
├── prisma/
│   ├── schema.prisma            # Prisma data model
│   ├── migrations/              # Auto-generated SQL migrations
│   └── seed.ts                  # Seeds first super_admin
│
├── src/
│   ├── app/
│   │   ├── (admin)/             # Admin route group
│   │   │   ├── admin/
│   │   │   │   ├── login/
│   │   │   │   ├── register/
│   │   │   │   ├── forgot-password/
│   │   │   │   ├── reset-password/
│   │   │   │   └── dashboard/
│   │   │   │       ├── exams/
│   │   │   │       │   ├── page.tsx       # Exam list
│   │   │   │       │   ├── new/page.tsx   # Create exam
│   │   │   │       │   └── [id]/
│   │   │   │       │       ├── page.tsx        # Exam overview
│   │   │   │       │       ├── questions/      # Question editor
│   │   │   │       │       ├── access/         # Access control
│   │   │   │       │       └── results/        # Submissions viewer
│   │   │   │       └── settings/page.tsx
│   │   │
│   │   ├── (exam)/              # Public exam route group
│   │   │   └── exam/
│   │   │       └── [slug]/
│   │   │           ├── page.tsx          # Exam entry (Gmail input)
│   │   │           ├── take/page.tsx     # Full-screen exam taking
│   │   │           └── result/page.tsx   # Result display
│   │   │
│   │   └── api/
│   │       ├── admin/
│   │       │   ├── auth/
│   │       │   │   ├── register/route.ts
│   │       │   │   ├── login/route.ts
│   │       │   │   ├── logout/route.ts
│   │       │   │   ├── refresh/route.ts
│   │       │   │   ├── verify-email/route.ts
│   │       │   │   ├── forgot-password/route.ts
│   │       │   │   └── reset-password/route.ts
│   │       │   ├── exams/
│   │       │   │   └── [...]/route.ts
│   │       │   └── me/route.ts
│   │       │
│   │       └── exam/
│   │           └── [slug]/
│   │               ├── route.ts
│   │               ├── verify-access/route.ts
│   │               ├── questions/route.ts
│   │               ├── response/route.ts
│   │               ├── submit/route.ts
│   │               ├── heartbeat/route.ts
│   │               └── result/[sessionId]/route.ts
│   │
│   ├── components/
│   │   ├── ui/                  # Shadcn components
│   │   ├── admin/               # Admin panel components
│   │   │   ├── ExamForm.tsx
│   │   │   ├── QuestionEditor.tsx
│   │   │   ├── AccessControl.tsx
│   │   │   └── SubmissionsTable.tsx
│   │   └── exam/                # Exam-taking components
│   │       ├── ExamEntry.tsx
│   │       ├── QuestionCard.tsx
│   │       ├── ExamTimer.tsx
│   │       ├── FullscreenGuard.tsx
│   │       └── ResultCard.tsx
│   │
│   ├── lib/
│   │   ├── prisma.ts            # Prisma client singleton
│   │   ├── auth.ts              # JWT helpers
│   │   ├── mailer.ts            # Nodemailer setup
│   │   ├── email-templates/     # HTML email templates
│   │   ├── validators/          # Zod schemas
│   │   └── utils.ts
│   │
│   └── middleware.ts            # Next.js middleware (JWT guard for /admin/dashboard)
│
├── .env.local
├── package.json
└── README.md
```

---

## 11. MVP Development Roadmap

### Phase 1 — Foundation (Week 1)
- [ ] Project setup: Next.js + Prisma + PostgreSQL + Shadcn UI
- [ ] Database schema migration and seed script
- [ ] Admin auth: register, email verify, login, refresh, logout
- [ ] Admin auth: forgot password, reset password
- [ ] Middleware for protected admin routes

### Phase 2 — Exam Builder (Week 2)
- [ ] Create / edit / delete exam forms
- [ ] Add / edit / delete / reorder questions
- [ ] Add options and mark correct answers
- [ ] Exam settings (time limit, shuffle, passing score)
- [ ] Access control (public link vs specific emails)
- [ ] Allowed email management (bulk add, remove)
- [ ] Publish / unpublish exam
- [ ] Shareable exam link generation

### Phase 3 — Exam Taking (Week 3)
- [ ] Public exam entry page (Gmail input + validation)
- [ ] Session creation and token handling
- [ ] Questions display with navigation
- [ ] Per-question response saving (auto-save)
- [ ] Countdown timer with auto-submit
- [ ] Full-screen enforcement and exit detection
- [ ] Tab switch detection and logging
- [ ] Beforeunload prevention
- [ ] Final submit with scoring
- [ ] Result display page

### Phase 4 — Admin Results & Notifications (Week 4)
- [ ] Submissions list per exam
- [ ] Individual submission detail view
- [ ] Basic analytics (total, average score, pass rate)
- [ ] Email: admin verification on register
- [ ] Email: password reset
- [ ] Email: student exam invite (specific access)
- [ ] Email: student result on submission
- [ ] Email: admin notification on new submission

### Phase 5 — Polish & Hardening
- [ ] Rate limiting on auth and exam APIs
- [ ] Input sanitization (Zod on all endpoints)
- [ ] Audit log writes for key admin actions
- [ ] Mobile-responsive admin panel
- [ ] Error handling and loading states throughout
- [ ] README and deployment guide

---

## 12. Claude Code Prompting Guide

When using Claude Code to build this project, break work into focused, atomic prompts. Below are suggested prompts per phase.

### Starting the Project

```
Set up a Next.js 14 App Router project with:
- TypeScript
- Prisma ORM connected to PostgreSQL (DATABASE_URL from .env)
- Shadcn UI initialized
- Tailwind CSS
- Zod for validation
- Nodemailer for email

Create the folder structure as defined in the project docs.
Do not generate any features yet — just the boilerplate.
```

### Database Setup

```
Using the SQL schema in the project documentation,
create the equivalent Prisma schema in prisma/schema.prisma.
Include all models:
admins, email_verification_tokens, password_reset_tokens,
password_reset_history, refresh_tokens, students,
exam_forms, exam_questions, exam_question_options,
exam_access_rules, exam_allowed_emails,
exam_sessions, exam_responses, exam_response_options,
email_notifications, audit_logs.

Then create prisma/seed.ts that seeds the first super_admin
using SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_ADMIN_NAME from .env.
```

### Admin Auth

```
Implement admin authentication in Next.js App Router API routes:
- POST /api/admin/auth/register  — creates admin (by logged-in admin), sends verification email
- POST /api/admin/auth/verify-email  — verifies token, activates account
- POST /api/admin/auth/login  — returns JWT access token (15m) + sets refresh token cookie (7d)
- POST /api/admin/auth/logout  — revokes refresh token
- POST /api/admin/auth/refresh  — rotates refresh token, returns new access token
- POST /api/admin/auth/forgot-password  — sends reset email via SMTP
- POST /api/admin/auth/reset-password  — validates token, hashes new password, logs history

Use bcrypt for password hashing. Use jsonwebtoken for JWT.
Store refresh token hash in the refresh_tokens table.
All tokens (email verify, password reset, refresh) must be stored as SHA-256 hashes.
```

### Exam Builder

```
Implement the exam management API routes (all protected by JWT middleware):
- GET/POST  /api/admin/exams
- GET/PATCH/DELETE  /api/admin/exams/[id]
- PATCH  /api/admin/exams/[id]/publish
- CRUD for /api/admin/exams/[id]/questions
- PATCH  /api/admin/exams/[id]/questions/reorder
- GET/PATCH  /api/admin/exams/[id]/access
- POST/DELETE for /api/admin/exams/[id]/access/emails

Validate all inputs with Zod.
Generate a unique slug for each exam on creation (slugify title + short UUID suffix).
```

### Exam Taking

```
Implement the public exam API routes:
- GET /api/exam/[slug]  — returns exam info if published and within schedule
- POST /api/exam/[slug]/verify-access  — validates Gmail, checks allowed list,
  checks for existing session, creates session and returns session_token
- GET /api/exam/[slug]/questions  — returns questions (and shuffled options if configured)
  requires valid session_token header
- POST /api/exam/[slug]/response  — saves answer for one question
- POST /api/exam/[slug]/submit  — calculates score, marks session submitted,
  triggers email notifications
- POST /api/exam/[slug]/heartbeat  — updates tab_switch_count or fullscreen_exit_count,
  checks for time expiry and auto-submits if needed

Session token must be validated on every protected endpoint.
One session per (exam_form_id, student_id) — enforce at DB and API level.
```

### Frontend — Exam Taking Page

```
Build the exam taking page at /exam/[slug]/take using React and Shadcn UI.
Features required:
1. On mount: request fullscreen (requestFullscreen API)
2. Detect fullscreen exit: show warning overlay, call heartbeat API
3. Detect tab/window visibility change: call heartbeat API
4. Prevent page exit with beforeunload event listener
5. Display questions one at a time with Prev/Next navigation
6. Auto-save answer on option select (call /response API)
7. Countdown timer (minutes:seconds) — call /submit on 0
8. Review modal before submit showing unanswered count
9. On submit: redirect to /exam/[slug]/result
Use sessionStorage to store session_token (never localStorage).
```

---

## Appendix A — Naming Conventions

| Type | Convention | Example |
|---|---|---|
| Table | snake_case, plural | `exam_questions` |
| Column | snake_case | `created_at`, `is_published` |
| Prisma Model | PascalCase | `ExamForm`, `Student` |
| API Route | kebab-case | `/verify-access`, `/reset-password` |
| React Component | PascalCase | `QuestionCard.tsx` |
| Utility File | camelCase | `mailer.ts`, `auth.ts` |
| Environment Var | SCREAMING_SNAKE_CASE | `JWT_ACCESS_SECRET` |

---

## Appendix B — Security Checklist

- [ ] Passwords hashed with bcrypt (rounds ≥ 12)
- [ ] All tokens stored as SHA-256 hashes in DB (never raw)
- [ ] JWT signed with strong secret (≥ 32 chars)
- [ ] Refresh tokens in HTTP-only, Secure, SameSite=Strict cookie
- [ ] Rate limiting on auth endpoints (e.g. 5 requests / 15 min per IP)
- [ ] Exam session token validated server-side on every call
- [ ] One-session enforcement at DB level (UNIQUE constraint)
- [ ] All inputs validated with Zod before DB write
- [ ] SQL injection prevented by Prisma parameterized queries
- [ ] CORS configured to allow only your own domain
- [ ] `exam_forms` slugs validated to prevent path traversal
- [ ] Sensitive fields (password_hash, token_hash) never returned in API responses
- [ ] Email normalized to lowercase before storage and comparison

---

*End of Document — HI Tech Examination MVP v1.0*
