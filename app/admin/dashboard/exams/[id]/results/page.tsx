"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/apiClient";
import { SubmissionsTable } from "@/components/admin/SubmissionsTable";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [sessions, setSessions] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [examTitle, setExamTitle] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch(`/api/admin/exams/${id}`).then((r) => r.json()),
      apiFetch(`/api/admin/exams/${id}/submissions`).then((r) => r.json()),
      apiFetch(`/api/admin/exams/${id}/analytics`).then((r) => r.json()),
    ])
      .then(([{ exam }, { sessions }, { analytics }]) => {
        setExamTitle(exam?.title ?? "");
        setSessions(sessions ?? []);
        setAnalytics(analytics ?? null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/admin/dashboard/exams/${id}`} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Submissions</h1>
          {examTitle && <p className="text-sm text-muted-foreground">{examTitle}</p>}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded" />)}
        </div>
      ) : (
        <SubmissionsTable sessions={sessions} analytics={analytics} examId={id} />
      )}
    </div>
  );
}
