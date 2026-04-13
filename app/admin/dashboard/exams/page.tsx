"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Clock, Users } from "lucide-react";

interface Exam {
  id: string;
  title: string;
  slug: string;
  status: string;
  isPublished: boolean;
  timeLimitMinutes: number | null;
  totalMarks: number;
  createdAt: string;
  _count: { questions: number; sessions: number };
}

const statusColors: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-700",
  published: "bg-green-100 text-green-700",
  closed: "bg-amber-100 text-amber-700",
  archived: "bg-red-100 text-red-700",
};

export default function ExamsListPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/api/admin/exams")
      .then((r) => r.json())
      .then(({ exams }) => setExams(exams ?? []))
      .catch(() => setError("Failed to load exams"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Exams</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your examination forms</p>
        </div>
        <Link href="/admin/dashboard/exams/new">
          <Button>
            <Plus size={16} className="mr-2" />
            New Exam
          </Button>
        </Link>
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : exams.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">No exams yet</p>
          <p className="text-sm mt-1">Create your first exam to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {exams.map((exam) => (
            <Link
              key={exam.id}
              href={`/admin/dashboard/exams/${exam.id}`}
              className="block border rounded-lg p-4 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{exam.title}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[exam.status] ?? ""}`}
                    >
                      {exam.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>{exam._count.questions} questions</span>
                    <span className="flex items-center gap-1">
                      <Users size={12} />
                      {exam._count.sessions} submissions
                    </span>
                    {exam.timeLimitMinutes && (
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {exam.timeLimitMinutes} min
                      </span>
                    )}
                    <span>{exam.totalMarks} marks</span>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(exam.createdAt).toLocaleDateString()}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
