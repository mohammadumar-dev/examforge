import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withExamSession } from "@/lib/withExamSession";
import { queueEmail } from "@/lib/mailer";
import { examResultEmail, newSubmissionEmail } from "@/lib/email-templates";

type RouteContext = { params: Promise<{ slug: string }> };

async function scoreAndSubmit(
  sessionId: string,
  examFormId: string,
  studentId: string,
  startedAt: Date,
  status: "submitted" | "auto_submitted"
) {
  const exam = await prisma.examForm.findUnique({
    where: { id: examFormId },
    include: {
      questions: {
        include: {
          options: { select: { id: true, isCorrect: true } },
          responses: {
            where: { sessionId },
            include: { selectedOptions: { select: { optionId: true } } },
          },
        },
      },
      admin: { select: { id: true, name: true, email: true } },
    },
  });

  if (!exam) throw new Error("Exam not found");

  type ExamQuestion = typeof exam.questions[number];
  type QuestionOption = ExamQuestion["options"][number];
  type ResponseOption = ExamQuestion["responses"][number]["selectedOptions"][number];

  let totalScore = 0;
  const totalMarks = exam.questions.reduce((sum: number, q: ExamQuestion) => sum + Number(q.marks), 0);
  const responseUpdates: Promise<unknown>[] = [];

  for (const question of exam.questions) {
    const response = question.responses[0];
    if (!response || response.isSkipped) continue;

    const correctOptionIds = new Set(question.options.filter((o: QuestionOption) => o.isCorrect).map((o: QuestionOption) => o.id));
    const selectedIds = new Set(response.selectedOptions.map((o: ResponseOption) => o.optionId));

    let isCorrect = false;

    if (question.questionType === "single_choice") {
      isCorrect =
        selectedIds.size === 1 && correctOptionIds.has([...selectedIds][0]);
    } else {
      // multiple_choice: all correct selected, no incorrect selected
      isCorrect =
        selectedIds.size === correctOptionIds.size &&
        [...selectedIds].every((id) => correctOptionIds.has(id));
    }

    const marksAwarded = isCorrect ? Number(question.marks) : 0;
    totalScore += marksAwarded;

    responseUpdates.push(
      prisma.examResponse.update({
        where: { id: response.id },
        data: { isCorrect, marksAwarded },
      })
    );
  }

  await Promise.all(responseUpdates);

  const percentage = totalMarks > 0 ? (totalScore / totalMarks) * 100 : 0;
  const isPassed = percentage >= (exam.passingScorePercent ?? 0);
  const timeTakenSeconds = Math.floor((Date.now() - startedAt.getTime()) / 1000);

  const session = await prisma.examSession.update({
    where: { id: sessionId },
    data: {
      status,
      submittedAt: new Date(),
      score: totalScore,
      totalMarks,
      percentage,
      isPassed,
      timeTakenSeconds,
    },
  });

  // Queue emails
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, email: true, name: true },
  });

  if (student && exam.showResultImmediately) {
    await queueEmail({
      to: student.email,
      subject: `Your result for: ${exam.title}`,
      html: examResultEmail(
        student.email,
        exam.title,
        totalScore,
        totalMarks,
        percentage,
        isPassed,
        timeTakenSeconds
      ),
      recipientType: "student",
      recipientId: student.id,
      notificationType: "student_exam_result",
      relatedExamId: examFormId,
    });
  }

  if (exam.admin) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const submissionsLink = `${appUrl}/admin/dashboard/exams/${examFormId}/results`;
    await queueEmail({
      to: exam.admin.email,
      subject: `New submission: ${exam.title}`,
      html: newSubmissionEmail(
        exam.admin.name,
        student?.email ?? "Unknown",
        exam.title,
        totalScore,
        totalMarks,
        percentage,
        submissionsLink
      ),
      recipientType: "admin",
      recipientId: exam.admin.id,
      notificationType: "admin_new_submission",
      relatedExamId: examFormId,
    });
  }

  return { session, score: totalScore, totalMarks, percentage, isPassed };
}

export function POST(req: NextRequest, ctx: RouteContext) {
  return withExamSession(async (req, { session }) => {
    const result = await scoreAndSubmit(
      session.id,
      session.examFormId,
      session.studentId,
      session.startedAt,
      "submitted"
    );

    return NextResponse.json({
      submitted: true,
      sessionId: session.id,
      score: result.score,
      totalMarks: result.totalMarks,
      percentage: Number(result.percentage.toFixed(1)),
      isPassed: result.isPassed,
    });
  })(req, ctx);
}
