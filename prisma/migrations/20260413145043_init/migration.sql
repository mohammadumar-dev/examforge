-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('super_admin', 'admin');

-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('draft', 'published', 'closed', 'archived');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('single_choice', 'multiple_choice');

-- CreateEnum
CREATE TYPE "AccessType" AS ENUM ('public_link', 'specific_emails');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('in_progress', 'submitted', 'auto_submitted', 'expired');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('pending', 'sent', 'failed');

-- CreateEnum
CREATE TYPE "NotificationRecipientType" AS ENUM ('admin', 'student');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('admin', 'system');

-- CreateTable
CREATE TABLE "admins" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'admin',
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "is_email_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_by_admin_id" TEXT,
    "last_login_at" TIMESTAMP(3),
    "last_login_ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "requested_ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_history" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "reset_ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(120),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_forms" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "time_limit_minutes" INTEGER,
    "scheduled_start_at" TIMESTAMP(3),
    "scheduled_end_at" TIMESTAMP(3),
    "passing_score_percent" INTEGER NOT NULL DEFAULT 0,
    "total_marks" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "shuffle_questions" BOOLEAN NOT NULL DEFAULT false,
    "shuffle_options" BOOLEAN NOT NULL DEFAULT false,
    "show_result_immediately" BOOLEAN NOT NULL DEFAULT true,
    "allow_review_answers" BOOLEAN NOT NULL DEFAULT false,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "max_attempts" INTEGER NOT NULL DEFAULT 1,
    "status" "ExamStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_questions" (
    "id" TEXT NOT NULL,
    "exam_form_id" TEXT NOT NULL,
    "question_text" TEXT NOT NULL,
    "question_type" "QuestionType" NOT NULL DEFAULT 'single_choice',
    "marks" DECIMAL(5,2) NOT NULL DEFAULT 1,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "explanation" TEXT,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_question_options" (
    "id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "option_text" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_question_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_access_rules" (
    "id" TEXT NOT NULL,
    "exam_form_id" TEXT NOT NULL,
    "access_type" "AccessType" NOT NULL DEFAULT 'specific_emails',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_access_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_allowed_emails" (
    "id" TEXT NOT NULL,
    "exam_form_id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invite_sent_at" TIMESTAMP(3),

    CONSTRAINT "exam_allowed_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_sessions" (
    "id" TEXT NOT NULL,
    "exam_form_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'in_progress',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),
    "time_taken_seconds" INTEGER,
    "score" DECIMAL(6,2),
    "total_marks" DECIMAL(6,2),
    "percentage" DECIMAL(5,2),
    "is_passed" BOOLEAN,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "tab_switch_count" INTEGER NOT NULL DEFAULT 0,
    "fullscreen_exit_count" INTEGER NOT NULL DEFAULT 0,
    "session_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_responses" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "is_skipped" BOOLEAN NOT NULL DEFAULT false,
    "is_correct" BOOLEAN,
    "marks_awarded" DECIMAL(5,2),
    "answered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_response_options" (
    "id" TEXT NOT NULL,
    "response_id" TEXT NOT NULL,
    "option_id" TEXT NOT NULL,

    CONSTRAINT "exam_response_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_notifications" (
    "id" TEXT NOT NULL,
    "recipient_type" "NotificationRecipientType" NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "recipient_email" VARCHAR(255) NOT NULL,
    "notification_type" VARCHAR(50) NOT NULL,
    "subject" TEXT NOT NULL,
    "body_html" TEXT,
    "status" "NotificationStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sent_at" TIMESTAMP(3),
    "failed_reason" TEXT,
    "related_exam_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_type" "AuditActorType" NOT NULL,
    "actor_id" TEXT,
    "action" VARCHAR(100) NOT NULL,
    "target_type" VARCHAR(50),
    "target_id" TEXT,
    "metadata" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- CreateIndex
CREATE INDEX "admins_email_idx" ON "admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_tokens_token_hash_key" ON "email_verification_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "email_verification_tokens_admin_id_idx" ON "email_verification_tokens"("admin_id");

-- CreateIndex
CREATE INDEX "email_verification_tokens_expires_at_idx" ON "email_verification_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_admin_id_idx" ON "password_reset_tokens"("admin_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_admin_id_idx" ON "refresh_tokens"("admin_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "students_email_key" ON "students"("email");

-- CreateIndex
CREATE INDEX "students_email_idx" ON "students"("email");

-- CreateIndex
CREATE UNIQUE INDEX "exam_forms_slug_key" ON "exam_forms"("slug");

-- CreateIndex
CREATE INDEX "exam_forms_admin_id_idx" ON "exam_forms"("admin_id");

-- CreateIndex
CREATE INDEX "exam_forms_slug_idx" ON "exam_forms"("slug");

-- CreateIndex
CREATE INDEX "exam_forms_status_idx" ON "exam_forms"("status");

-- CreateIndex
CREATE INDEX "exam_questions_exam_form_id_idx" ON "exam_questions"("exam_form_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_questions_exam_form_id_order_index_key" ON "exam_questions"("exam_form_id", "order_index");

-- CreateIndex
CREATE INDEX "exam_question_options_question_id_idx" ON "exam_question_options"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_access_rules_exam_form_id_key" ON "exam_access_rules"("exam_form_id");

-- CreateIndex
CREATE INDEX "exam_allowed_emails_exam_form_id_idx" ON "exam_allowed_emails"("exam_form_id");

-- CreateIndex
CREATE INDEX "exam_allowed_emails_email_idx" ON "exam_allowed_emails"("email");

-- CreateIndex
CREATE UNIQUE INDEX "exam_allowed_emails_exam_form_id_email_key" ON "exam_allowed_emails"("exam_form_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "exam_sessions_session_token_key" ON "exam_sessions"("session_token");

-- CreateIndex
CREATE INDEX "exam_sessions_exam_form_id_idx" ON "exam_sessions"("exam_form_id");

-- CreateIndex
CREATE INDEX "exam_sessions_student_id_idx" ON "exam_sessions"("student_id");

-- CreateIndex
CREATE INDEX "exam_sessions_status_idx" ON "exam_sessions"("status");

-- CreateIndex
CREATE INDEX "exam_sessions_session_token_idx" ON "exam_sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "exam_sessions_exam_form_id_student_id_key" ON "exam_sessions"("exam_form_id", "student_id");

-- CreateIndex
CREATE INDEX "exam_responses_session_id_idx" ON "exam_responses"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_responses_session_id_question_id_key" ON "exam_responses"("session_id", "question_id");

-- CreateIndex
CREATE INDEX "exam_response_options_response_id_idx" ON "exam_response_options"("response_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_response_options_response_id_option_id_key" ON "exam_response_options"("response_id", "option_id");

-- CreateIndex
CREATE INDEX "email_notifications_recipient_type_recipient_id_idx" ON "email_notifications"("recipient_type", "recipient_id");

-- CreateIndex
CREATE INDEX "email_notifications_status_idx" ON "email_notifications"("status");

-- CreateIndex
CREATE INDEX "email_notifications_related_exam_id_idx" ON "email_notifications"("related_exam_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_type_actor_id_idx" ON "audit_logs"("actor_type", "actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "admins" ADD CONSTRAINT "admins_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_history" ADD CONSTRAINT "password_reset_history_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_forms" ADD CONSTRAINT "exam_forms_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_exam_form_id_fkey" FOREIGN KEY ("exam_form_id") REFERENCES "exam_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_question_options" ADD CONSTRAINT "exam_question_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "exam_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_access_rules" ADD CONSTRAINT "exam_access_rules_exam_form_id_fkey" FOREIGN KEY ("exam_form_id") REFERENCES "exam_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_allowed_emails" ADD CONSTRAINT "exam_allowed_emails_exam_form_id_fkey" FOREIGN KEY ("exam_form_id") REFERENCES "exam_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_sessions" ADD CONSTRAINT "exam_sessions_exam_form_id_fkey" FOREIGN KEY ("exam_form_id") REFERENCES "exam_forms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_sessions" ADD CONSTRAINT "exam_sessions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_responses" ADD CONSTRAINT "exam_responses_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "exam_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_responses" ADD CONSTRAINT "exam_responses_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "exam_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_response_options" ADD CONSTRAINT "exam_response_options_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "exam_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_response_options" ADD CONSTRAINT "exam_response_options_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "exam_question_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_notifications" ADD CONSTRAINT "email_notifications_related_exam_id_fkey" FOREIGN KEY ("related_exam_id") REFERENCES "exam_forms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
