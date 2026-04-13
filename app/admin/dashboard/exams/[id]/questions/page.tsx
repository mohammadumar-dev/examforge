"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/apiClient";
import { QuestionEditor } from "@/components/admin/QuestionEditor";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";

export default function QuestionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [questions, setQuestions] = useState<any[]>([]);
  const [examTitle, setExamTitle] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/api/admin/exams/${id}`)
      .then((r) => r.json())
      .then(({ exam }) => {
        setExamTitle(exam.title);
        setQuestions(exam.questions ?? []);
      })
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/admin/dashboard/exams/${id}`} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Questions</h1>
          {examTitle && <p className="text-sm text-muted-foreground">{examTitle}</p>}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
      ) : (
        <QuestionEditor examId={id} questions={questions} onUpdate={setQuestions} />
      )}
    </div>
  );
}
