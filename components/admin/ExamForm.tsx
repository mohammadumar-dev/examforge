"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { AlertCircle, BookOpen, Clock, Settings2 } from "lucide-react";

interface ExamFormData {
  title: string;
  description: string;
  instructions: string;
  timeLimitMinutes: string;
  passingScorePercent: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showResultImmediately: boolean;
  allowReviewAnswers: boolean;
}

interface ExamFormProps {
  examId?: string;
  initial?: Partial<ExamFormData>;
  mode: "create" | "edit";
}

const toggleConfig: {
  key: keyof ExamFormData;
  label: string;
  description: string;
}[] = [
  {
    key: "shuffleQuestions",
    label: "Shuffle question order",
    description: "Questions appear in random order for each student",
  },
  {
    key: "shuffleOptions",
    label: "Shuffle answer options",
    description: "Answer options are randomized per question",
  },
  {
    key: "showResultImmediately",
    label: "Show result immediately",
    description: "Students see their score right after submitting",
  },
  {
    key: "allowReviewAnswers",
    label: "Allow answer review",
    description: "Students can review correct/incorrect answers",
  },
];

export function ExamForm({ examId, initial, mode }: ExamFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<ExamFormData>({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    instructions: initial?.instructions ?? "",
    timeLimitMinutes: initial?.timeLimitMinutes ?? "",
    passingScorePercent: initial?.passingScorePercent ?? "0",
    scheduledStartAt: initial?.scheduledStartAt ?? "",
    scheduledEndAt: initial?.scheduledEndAt ?? "",
    shuffleQuestions: initial?.shuffleQuestions ?? false,
    shuffleOptions: initial?.shuffleOptions ?? false,
    showResultImmediately: initial?.showResultImmediately ?? true,
    allowReviewAnswers: initial?.allowReviewAnswers ?? false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function set(key: keyof ExamFormData, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const payload = {
      title: form.title,
      description: form.description || undefined,
      instructions: form.instructions || undefined,
      timeLimitMinutes: form.timeLimitMinutes ? Number(form.timeLimitMinutes) : null,
      passingScorePercent: Number(form.passingScorePercent),
      scheduledStartAt: form.scheduledStartAt ? new Date(form.scheduledStartAt).toISOString() : null,
      scheduledEndAt: form.scheduledEndAt ? new Date(form.scheduledEndAt).toISOString() : null,
      shuffleQuestions: form.shuffleQuestions,
      shuffleOptions: form.shuffleOptions,
      showResultImmediately: form.showResultImmediately,
      allowReviewAnswers: form.allowReviewAnswers,
    };

    try {
      const res = await apiFetch(
        mode === "create" ? "/api/admin/exams" : `/api/admin/exams/${examId}`,
        { method: mode === "create" ? "POST" : "PATCH", json: payload }
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }

      router.push(`/admin/dashboard/exams/${data.exam.id}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl">
      {/* Section 1: Basic Info */}
      <div className="bg-card border rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
            <BookOpen size={14} className="text-primary" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">Basic Info</h2>
        </div>

        <div className="space-y-2">
          <Label htmlFor="title">
            Exam Title <span className="text-destructive">*</span>
          </Label>
          <Input
            id="title"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. JavaScript Fundamentals Quiz"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Brief description of the exam"
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="instructions">Instructions for Students</Label>
          <Textarea
            id="instructions"
            value={form.instructions}
            onChange={(e) => set("instructions", e.target.value)}
            placeholder="Instructions shown to students before they start"
            rows={3}
          />
        </div>
      </div>

      {/* Section 2: Scheduling & Scoring */}
      <div className="bg-card border rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
            <Clock size={14} className="text-primary" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">Scheduling &amp; Scoring</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="timeLimitMinutes">Time Limit (minutes)</Label>
            <Input
              id="timeLimitMinutes"
              type="number"
              min={1}
              value={form.timeLimitMinutes}
              onChange={(e) => set("timeLimitMinutes", e.target.value)}
              placeholder="No limit"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="passingScorePercent">Passing Score (%)</Label>
            <Input
              id="passingScorePercent"
              type="number"
              min={0}
              max={100}
              value={form.passingScorePercent}
              onChange={(e) => set("passingScorePercent", e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="scheduledStartAt">Available From</Label>
            <Input
              id="scheduledStartAt"
              type="datetime-local"
              value={form.scheduledStartAt}
              onChange={(e) => set("scheduledStartAt", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="scheduledEndAt">Available Until</Label>
            <Input
              id="scheduledEndAt"
              type="datetime-local"
              value={form.scheduledEndAt}
              onChange={(e) => set("scheduledEndAt", e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Section 3: Exam Options */}
      <div className="bg-card border rounded-xl p-6 space-y-1">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
            <Settings2 size={14} className="text-primary" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">Exam Options</h2>
        </div>

        {toggleConfig.map(({ key, label, description }) => (
          <div
            key={key}
            className="flex items-center justify-between py-3 border-b last:border-0"
          >
            <div className="space-y-0.5 pr-4">
              <Label htmlFor={key} className="cursor-pointer text-sm font-medium">
                {label}
              </Label>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <Switch
              id={key}
              checked={form[key] as boolean}
              onCheckedChange={(checked) => set(key, checked)}
            />
          </div>
        ))}
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/8 border border-destructive/20 px-3 py-2.5 rounded-lg flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : mode === "create" ? "Create Exam" : "Save Changes"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
