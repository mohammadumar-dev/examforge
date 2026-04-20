import { ExamEntry } from "@/components/exam/ExamEntry";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ email?: string; pwd?: string }>;
}

export default async function ExamEntryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { email, pwd } = await searchParams;

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/exam/${slug}`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-2">
          <p className="text-2xl font-bold">Exam Not Available</p>
          <p className="text-muted-foreground">{data.error ?? "This exam is not available."}</p>
          {data.startsAt && (
            <p className="text-sm">
              Starts at: {new Date(data.startsAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    );
  }

  const { exam } = await res.json();
  return <ExamEntry exam={exam} prefillEmail={email} prefillPassword={pwd} />;
}
