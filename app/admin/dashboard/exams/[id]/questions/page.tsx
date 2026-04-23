"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/apiClient";
import { QuestionEditor } from "@/components/admin/QuestionEditor";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";

export default function QuestionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [questions, setQuestions] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [sections, setSections] = useState<any[]>([]);
  const [examTitle, setExamTitle] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/api/admin/exams/${id}`)
      .then((r) => r.json())
      .then(({ exam }) => {
        setExamTitle(exam.title);
        setQuestions(exam.questions ?? []);
        setSections(exam.sections ?? []);
      })
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="flex flex-col flex-1 p-6 gap-6">
      {/* Back + header */}
      <div>
        <Link
          href={`/admin/dashboard/exams/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Questions</h1>
          {!loading && (
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {questions.length}
            </span>
          )}
        </div>
        {examTitle && (
          <p className="text-sm text-muted-foreground mt-1">{examTitle}</p>
        )}
      </div>

      {/* Loading skeleton */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <QuestionEditor
          examId={id}
          questions={questions}
          sections={sections}
          onUpdate={setQuestions}
          onSectionsUpdate={setSections}
        />
      )}
    </div>
  );
}
