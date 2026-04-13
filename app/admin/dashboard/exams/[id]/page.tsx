"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Users, FileQuestion, Shield, BarChart2, Copy, Check } from "lucide-react";

interface ExamDetail {
  id: string;
  title: string;
  slug: string;
  description: string;
  status: string;
  isPublished: boolean;
  timeLimitMinutes: number | null;
  totalMarks: number;
  passingScorePercent: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showResultImmediately: boolean;
  allowReviewAnswers: boolean;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  _count: { sessions: number };
}

const statusColors: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-700",
  published: "bg-green-100 text-green-700",
  closed: "bg-amber-100 text-amber-700",
  archived: "bg-red-100 text-red-700",
};

export default function ExamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const appUrl =
    typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL ?? "";
  const examLink = exam ? `${appUrl}/exam/${exam.slug}` : "";

  useEffect(() => {
    apiFetch(`/api/admin/exams/${id}`)
      .then((r) => r.json())
      .then(({ exam }) => setExam(exam))
      .catch(() => setError("Failed to load exam"))
      .finally(() => setLoading(false));
  }, [id]);

  async function togglePublish() {
    if (!exam) return;
    setPublishing(true);
    const res = await apiFetch(`/api/admin/exams/${id}/publish`, { method: "PATCH" });
    const data = await res.json();
    if (res.ok) {
      setExam((e) => e && { ...e, isPublished: data.exam.isPublished, status: data.exam.status });
    } else {
      setError(data.error ?? "Failed to update");
    }
    setPublishing(false);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(examLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return <div className="p-6"><Skeleton className="h-64 w-full rounded-lg" /></div>;
  if (!exam) return <div className="p-6 text-destructive">{error || "Exam not found"}</div>;

  const navLinks = [
    { href: `/admin/dashboard/exams/${id}/questions`, label: "Questions", icon: FileQuestion },
    { href: `/admin/dashboard/exams/${id}/access`, label: "Access Control", icon: Shield },
    { href: `/admin/dashboard/exams/${id}/results`, label: "Submissions", icon: Users },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight truncate">{exam.title}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[exam.status]}`}>
              {exam.status}
            </span>
          </div>
          {exam.description && <p className="text-sm text-muted-foreground mt-1">{exam.description}</p>}
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href={`/admin/dashboard/exams/${id}/questions`}>
            <Button variant="outline" size="sm">Edit Questions</Button>
          </Link>
          <Button
            onClick={togglePublish}
            disabled={publishing}
            size="sm"
            variant={exam.isPublished ? "destructive" : "default"}
          >
            {publishing ? "…" : exam.isPublished ? "Unpublish" : "Publish"}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>}

      {/* Exam link */}
      {exam.isPublished && (
        <div className="flex items-center gap-2 border rounded-lg p-3 bg-green-50">
          <span className="text-sm flex-1 truncate font-mono text-green-800">{examLink}</span>
          <Button size="sm" variant="outline" onClick={copyLink} className="shrink-0">
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Submissions</p>
          <p className="text-2xl font-bold mt-1">{exam._count.sessions}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Total Marks</p>
          <p className="text-2xl font-bold mt-1">{exam.totalMarks}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Pass Score</p>
          <p className="text-2xl font-bold mt-1">{exam.passingScorePercent}%</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Time Limit</p>
          <p className="text-2xl font-bold mt-1">
            {exam.timeLimitMinutes ? `${exam.timeLimitMinutes}m` : "None"}
          </p>
        </div>
      </div>

      {/* Navigation sections */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {navLinks.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="border rounded-lg p-4 hover:bg-accent/50 transition-colors flex items-center gap-3"
          >
            <Icon size={20} className="text-muted-foreground" />
            <span className="font-medium">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
