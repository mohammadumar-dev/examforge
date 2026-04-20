"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useParams, useRouter } from "next/navigation";
import { ResultCard, type ResultData } from "@/components/exam/ResultCard";
import { Loader2, FileX } from "lucide-react";
import { Button } from "@/components/ui/button";

function ResultContent() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");

  const token = searchParams.get("token");

  const [result, setResult] = useState<ResultData | null>(null);
  const [examTitle, setExamTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sessionId) {
      setError("No session ID provided");
      setLoading(false);
      return;
    }

    Promise.all([
      fetch(`/api/exam/${slug}`).then((r) => r.json()),
      fetch(`/api/exam/${slug}/result/${sessionId}`).then((r) => r.json()),
    ])
      .then(([examData, resultData]) => {
        setExamTitle(examData.exam?.title ?? "");
        if (resultData.result) {
          setResult(resultData.result);
        } else if (resultData.message) {
          setError(resultData.message);
        } else {
          setError(resultData.error ?? "Result not found");
        }
      })
      .catch(() => setError("Failed to load result"))
      .finally(() => setLoading(false));
  }, [slug, sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 size={28} className="animate-spin text-primary" />
          <p className="text-sm">Loading your results…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="bg-card border rounded-2xl shadow-sm p-8 max-w-sm w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto">
            <FileX size={26} className="text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h2 className="font-bold text-lg">Result Not Found</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{error}</p>
          </div>
          <Button variant="outline" className="w-full" onClick={() => router.push(`/exam/${slug}`)}>
            Back to Exam
          </Button>
        </div>
      </div>
    );
  }

  if (!result) return null;

  return <ResultCard result={result} examTitle={examTitle} slug={slug} pdfToken={result.resultShareToken ?? token ?? undefined} />;
}

export default function ResultPage() {
  return (
    <Suspense>
      <ResultContent />
    </Suspense>
  );
}
