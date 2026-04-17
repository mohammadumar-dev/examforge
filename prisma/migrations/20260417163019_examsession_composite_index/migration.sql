-- CreateIndex
CREATE INDEX "exam_sessions_exam_form_id_student_id_status_idx" ON "exam_sessions"("exam_form_id", "student_id", "status");
