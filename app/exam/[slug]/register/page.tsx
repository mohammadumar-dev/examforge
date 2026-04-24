import { ExamEnrollment } from "@/components/exam/ExamEnrollment";
import { LocalTime } from "@/components/LocalTime";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ExamRegisterPage({ params }: Props) {
  const { slug } = await params;

  const exam = await prisma.examForm.findUnique({
    where: { slug },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      instructions: true,
      timeLimitMinutes: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
      passingScorePercent: true,
      totalMarks: true,
      showResultImmediately: true,
      isPublished: true,
      status: true,
      accessRule: {
        select: {
          accessType: true,
          registrationStartAt: true,
          registrationEndAt: true,
        },
      },
      _count: { select: { questions: true } },
    },
  });

  if (!exam || !exam.isPublished || exam.status !== "published") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-2">
          <p className="text-2xl font-bold">Exam Not Available</p>
          <p className="text-muted-foreground">This exam is not available.</p>
        </div>
      </div>
    );
  }

  const now = new Date();
  if (exam.scheduledStartAt && new Date(exam.scheduledStartAt) > now) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-2">
          <p className="text-2xl font-bold">Exam Not Available</p>
          <p className="text-muted-foreground">Exam has not started yet.</p>
          <p className="text-sm">Starts at: <LocalTime iso={exam.scheduledStartAt.toISOString()} /></p>
        </div>
      </div>
    );
  }

  if (exam.scheduledEndAt && new Date(exam.scheduledEndAt) < now) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-2">
          <p className="text-2xl font-bold">Exam Not Available</p>
          <p className="text-muted-foreground">This exam has ended.</p>
        </div>
      </div>
    );
  }

  const regStart = exam.accessRule?.registrationStartAt;
  const regEnd = exam.accessRule?.registrationEndAt;

  if (regStart && new Date(regStart) > now) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-2">
          <p className="text-2xl font-bold">Registration Not Open Yet</p>
          <p className="text-muted-foreground">Registration opens at:</p>
          <p className="text-sm font-medium"><LocalTime iso={new Date(regStart).toISOString()} /></p>
        </div>
      </div>
    );
  }

  if (regEnd && new Date(regEnd) < now) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-2">
          <p className="text-2xl font-bold">Registration Closed</p>
          <p className="text-muted-foreground">The registration period for this exam has ended.</p>
        </div>
      </div>
    );
  }

  return <ExamEnrollment exam={{ ...exam, totalMarks: Number(exam.totalMarks) }} />;
}
