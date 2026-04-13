"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ExamInfo {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  instructions: string | null;
  timeLimitMinutes: number | null;
  totalMarks: number;
  _count: { questions: number };
  accessRule: { accessType: string } | null;
}

interface ExamEntryProps {
  exam: ExamInfo;
}

export function ExamEntry({ exam }: ExamEntryProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`/api/exam/${exam.slug}/verify-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase(), name: name || undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Access denied");
        return;
      }

      sessionStorage.setItem("session_token", data.sessionToken);
      sessionStorage.setItem("session_id", data.sessionId);
      sessionStorage.setItem("exam_slug", exam.slug);

      router.push(`/exam/${exam.slug}/take`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="border rounded-xl p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{exam.title}</h1>
            {exam.description && (
              <p className="text-sm text-muted-foreground mt-2">{exam.description}</p>
            )}
          </div>

          {/* Exam info */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Questions</p>
              <p className="text-lg font-semibold">{exam._count.questions}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Total Marks</p>
              <p className="text-lg font-semibold">{exam.totalMarks}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Time Limit</p>
              <p className="text-lg font-semibold">
                {exam.timeLimitMinutes ? `${exam.timeLimitMinutes}m` : "None"}
              </p>
            </div>
          </div>

          {exam.instructions && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-blue-800 mb-1">Instructions</p>
              <p className="text-sm text-blue-900 whitespace-pre-wrap">{exam.instructions}</p>
            </div>
          )}

          <form onSubmit={handleStart} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Your Gmail Address *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@gmail.com"
                required
              />
              <p className="text-xs text-muted-foreground">
                Use your Gmail. This will be your identifier for this exam.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Your Name (optional)</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? "Verifying…" : "Start Exam"}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center">
            By starting, you agree that this exam will run in fullscreen mode and tab-switching will be
            monitored.
          </p>
        </div>
      </div>
    </div>
  );
}
