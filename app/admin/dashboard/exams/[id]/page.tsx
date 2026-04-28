"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Users,
  FileQuestion,
  Shield,
  ListChecks,
  Copy,
  Check,
  ExternalLink,
  ArrowRight,
  Pencil,
  X,
  AlertCircle,
} from "lucide-react";

interface ExamDetail {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  instructions: string | null;
  status: string;
  isPublished: boolean;
  timeLimitMinutes: number | null;
  totalMarks: number;
  passingScorePercent: number;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  _count: { sessions: number };
}

interface EditForm {
  title: string;
  description: string;
  instructions: string;
  timeLimitMinutes: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
}

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const statusConfig: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  published: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  closed: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  archived: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const navLinks = (id: string) => [
  {
    href: `/admin/dashboard/exams/${id}/questions`,
    label: "Questions",
    description: "Manage and reorder exam questions",
    icon: FileQuestion,
  },
  {
    href: `/admin/dashboard/exams/${id}/access`,
    label: "Access Control",
    description: "Configure who can take this exam",
    icon: Shield,
  },
  {
    href: `/admin/dashboard/exams/${id}/results`,
    label: "Submissions",
    description: "View student results and analytics",
    icon: Users,
  },
  {
    href: `/admin/dashboard/exams/enrollment?examId=${id}`,
    label: "Enrollments",
    description: "View all students enrolled in this exam",
    icon: ListChecks,
  },
];

export default function ExamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    title: "",
    description: "",
    instructions: "",
    timeLimitMinutes: "",
    scheduledStartAt: "",
    scheduledEndAt: "",
  });
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const appUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL ?? "";
  const examLink = exam ? `${appUrl}/exam/${exam.slug}/register` : "";

  useEffect(() => {
    apiFetch(`/api/admin/exams/${id}`)
      .then((r) => r.json())
      .then(({ exam }) => setExam(exam))
      .catch(() => setError("Failed to load exam"))
      .finally(() => setLoading(false));
  }, [id]);

  function openEdit() {
    if (!exam) return;
    setEditForm({
      title: exam.title,
      description: exam.description ?? "",
      instructions: exam.instructions ?? "",
      timeLimitMinutes: exam.timeLimitMinutes ? String(exam.timeLimitMinutes) : "",
      scheduledStartAt: toDatetimeLocal(exam.scheduledStartAt),
      scheduledEndAt: toDatetimeLocal(exam.scheduledEndAt),
    });
    setEditError("");
    setEditing(true);
  }

  function closeEdit() {
    setEditing(false);
    setEditError("");
  }

  function setField(key: keyof EditForm, value: string) {
    setEditForm((f) => ({ ...f, [key]: value }));
  }

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setEditError("");

    const payload = {
      title: editForm.title,
      description: editForm.description || null,
      instructions: editForm.instructions || null,
      timeLimitMinutes: editForm.timeLimitMinutes ? Number(editForm.timeLimitMinutes) : null,
      scheduledStartAt: editForm.scheduledStartAt
        ? new Date(editForm.scheduledStartAt).toISOString()
        : null,
      scheduledEndAt: editForm.scheduledEndAt
        ? new Date(editForm.scheduledEndAt).toISOString()
        : null,
    };

    try {
      const res = await apiFetch(`/api/admin/exams/${id}/details`, {
        method: "PATCH",
        json: payload,
      });
      const data = await res.json();

      if (!res.ok) {
        setEditError(data.error ?? "Save failed");
        return;
      }

      setExam((prev) =>
        prev
          ? {
              ...prev,
              title: data.exam.title,
              description: data.exam.description,
              instructions: data.exam.instructions,
              timeLimitMinutes: data.exam.timeLimitMinutes,
              scheduledStartAt: data.exam.scheduledStartAt,
              scheduledEndAt: data.exam.scheduledEndAt,
            }
          : prev
      );
      setEditing(false);
    } catch {
      setEditError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

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

  if (loading) {
    return (
      <div className="flex flex-col flex-1 p-6 gap-6">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="flex flex-col flex-1 p-6 gap-6">
        <p className="text-sm text-destructive bg-destructive/8 border border-destructive/20 px-3 py-2.5 rounded-lg">
          {error || "Exam not found"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 p-6 gap-6">
      {/* Back navigation */}
      <div>
        <Link
          href="/admin/dashboard/exams"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight truncate">{exam.title}</h1>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${statusConfig[exam.status] ?? ""}`}
              >
                {exam.status}
              </span>
            </div>
            {exam.description && (
              <p className="text-sm text-muted-foreground mt-1">{exam.description}</p>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={editing ? closeEdit : openEdit}>
              {editing ? (
                <>
                  <X className="size-3.5 mr-1.5" />
                  Cancel Edit
                </>
              ) : (
                <>
                  <Pencil className="size-3.5 mr-1.5" />
                  Edit Details
                </>
              )}
            </Button>
            <Link href={`/admin/dashboard/exams/${id}/questions`}>
              <Button variant="outline" size="sm">
                Edit Questions
              </Button>
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
      </div>

      {/* Global error */}
      {error && (
        <p className="text-sm text-destructive bg-destructive/8 border border-destructive/20 px-3 py-2.5 rounded-lg">
          {error}
        </p>
      )}

      {/* Inline edit panel */}
      {editing && (
        <form
          onSubmit={saveDetails}
          className="bg-card border rounded-xl p-6 space-y-5"
        >
          <h2 className="text-sm font-semibold">Edit Exam Details</h2>

          <div className="space-y-2">
            <Label htmlFor="edit-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-title"
              value={editForm.title}
              onChange={(e) => setField("title", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={editForm.description}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="Brief description of the exam"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-instructions">Instructions for Students</Label>
            <Textarea
              id="edit-instructions"
              value={editForm.instructions}
              onChange={(e) => setField("instructions", e.target.value)}
              placeholder="Instructions shown to students before they start"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-timeLimit">Time Limit (minutes)</Label>
              <Input
                id="edit-timeLimit"
                type="number"
                min={1}
                value={editForm.timeLimitMinutes}
                onChange={(e) => setField("timeLimitMinutes", e.target.value)}
                placeholder="No limit"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-startAt">Available From</Label>
              <Input
                id="edit-startAt"
                type="datetime-local"
                value={editForm.scheduledStartAt}
                onChange={(e) => setField("scheduledStartAt", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-endAt">Available Until</Label>
              <Input
                id="edit-endAt"
                type="datetime-local"
                value={editForm.scheduledEndAt}
                onChange={(e) => setField("scheduledEndAt", e.target.value)}
              />
            </div>
          </div>

          {editError && (
            <div className="text-sm text-destructive bg-destructive/8 border border-destructive/20 px-3 py-2.5 rounded-lg flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              {editError}
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={closeEdit}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Published link */}
      {exam.isPublished && (
        <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-3">
          <ExternalLink className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="text-sm flex-1 truncate font-mono text-emerald-800 dark:text-emerald-300">
            {examLink}
          </span>
          <Button size="sm" variant="outline" onClick={copyLink} className="shrink-0">
            {copied ? <Check className="size-3.5 mr-1" /> : <Copy className="size-3.5 mr-1" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-xl p-5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Submissions</p>
          <p className="text-3xl font-bold mt-1.5">{exam._count.sessions}</p>
          <p className="text-xs text-muted-foreground mt-1">students</p>
        </div>
        <div className="bg-card border rounded-xl p-5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Marks</p>
          <p className="text-3xl font-bold mt-1.5">{exam.totalMarks}</p>
          <p className="text-xs text-muted-foreground mt-1">points</p>
        </div>
        <div className="bg-card border rounded-xl p-5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pass Score</p>
          <p className="text-3xl font-bold mt-1.5">{exam.passingScorePercent}%</p>
          <p className="text-xs text-muted-foreground mt-1">threshold</p>
        </div>
        <div className="bg-card border rounded-xl p-5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Time Limit</p>
          <p className="text-3xl font-bold mt-1.5">
            {exam.timeLimitMinutes ? `${exam.timeLimitMinutes}` : "—"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {exam.timeLimitMinutes ? "minutes" : "no limit"}
          </p>
        </div>
      </div>

      {/* Navigation cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {navLinks(id).map(({ href, label, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="bg-card border rounded-xl p-5 hover:bg-accent/40 transition-colors flex items-center gap-4"
          >
            <div className="shrink-0 rounded-lg bg-muted p-2.5">
              <Icon className="size-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            </div>
            <ArrowRight className="size-4 text-muted-foreground shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
