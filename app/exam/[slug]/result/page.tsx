"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useParams } from "next/navigation";
import { ResultCard } from "@/components/exam/ResultCard";
import { Loader2 } from "lucide-react";

function ResultContent() {
  const params = useParams();
  const slug = params.slug as string;
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");

  const [result, setResult] = useState(null);
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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <p className="text-2xl">📝</p>
          <p className="font-medium">{error}</p>
        </div>
      </div>
    );
  }

  if (!result) return null;

  return <ResultCard result={result} examTitle={examTitle} />;
}

export default function ResultPage() {
  return (
    <Suspense>
      <ResultContent />
    </Suspense>
  );
}
