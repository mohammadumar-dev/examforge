"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

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
      scheduledStartAt: form.scheduledStartAt || null,
      scheduledEndAt: form.scheduledEndAt || null,
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
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="space-y-2">
        <Label htmlFor="title">Exam Title *</Label>
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

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="timeLimitMinutes">Time Limit (minutes)</Label>
          <Input
            id="timeLimitMinutes"
            type="number"
            min={1}
            value={form.timeLimitMinutes}
            onChange={(e) => set("timeLimitMinutes", e.target.value)}
            placeholder="Leave blank for no limit"
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

      <div className="border rounded-lg p-4 space-y-4">
        <h3 className="text-sm font-semibold">Exam Options</h3>
        {(
          [
            ["shuffleQuestions", "Shuffle question order"],
            ["shuffleOptions", "Shuffle answer options"],
            ["showResultImmediately", "Show result immediately after submission"],
            ["allowReviewAnswers", "Allow students to review their answers"],
          ] as [keyof ExamFormData, string][]
        ).map(([key, label]) => (
          <div key={key} className="flex items-center justify-between">
            <Label htmlFor={key} className="cursor-pointer">
              {label}
            </Label>
            <Switch
              id={key}
              checked={form[key] as boolean}
              onCheckedChange={(checked) => set(key, checked)}
            />
          </div>
        ))}
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : mode === "create" ? "Create Exam" : "Save Changes"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
