import { ExamEntry } from "@/components/exam/ExamEntry";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ email?: string; pwd?: string }>;
}

export default async function ExamEntryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { email, pwd } = await searchParams;

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
      accessRule: { select: { accessType: true } },
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
          <p className="text-sm">Starts at: {new Date(exam.scheduledStartAt).toLocaleString()}</p>
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

  return <ExamEntry exam={{ ...exam, totalMarks: Number(exam.totalMarks) }} prefillEmail={email} prefillPassword={pwd} />;
}
