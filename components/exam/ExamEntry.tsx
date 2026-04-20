"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  GraduationCap,
  Info,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  BookOpen,
  Star,
  Clock,
} from "lucide-react";

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
  prefillEmail?: string;
  prefillPassword?: string;
}

export function ExamEntry({ exam, prefillEmail, prefillPassword }: ExamEntryProps) {
  const router = useRouter();
  const [email, setEmail] = useState(prefillEmail ?? "");
  const [password, setPassword] = useState(prefillPassword ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const autoSubmitted = useRef(false);

  useEffect(() => {
    if (prefillEmail && prefillPassword && !autoSubmitted.current) {
      autoSubmitted.current = true;
      handleStart();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleStart(e?: React.FormEvent) {
    e?.preventDefault();
    setError("");
    setLoading(true);

    const emailVal = e ? email : (prefillEmail ?? email);
    const pwdVal   = e ? password : (prefillPassword ?? password);

    try {
      const res = await fetch(`/api/exam/${exam.slug}/verify-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailVal.toLowerCase(), password: pwdVal }),
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-card border rounded-2xl shadow-sm overflow-hidden">
        {/* Coral gradient header */}
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 border-b p-6">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <GraduationCap size={22} className="text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight leading-snug">{exam.title}</h1>
              {exam.description && (
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  {exam.description}
                </p>
              )}
            </div>
          </div>

          {/* Exam info pills */}
          <div className="flex flex-wrap gap-2 mt-5">
            <span className="inline-flex items-center gap-1.5 bg-background border rounded-full px-3 py-1 text-xs font-medium">
              <BookOpen size={11} className="text-primary" />
              {exam._count.questions} Questions
            </span>
            <span className="inline-flex items-center gap-1.5 bg-background border rounded-full px-3 py-1 text-xs font-medium">
              <Star size={11} className="text-primary" />
              {exam.totalMarks} Marks
            </span>
            <span className="inline-flex items-center gap-1.5 bg-background border rounded-full px-3 py-1 text-xs font-medium">
              <Clock size={11} className="text-primary" />
              {exam.timeLimitMinutes ? `${exam.timeLimitMinutes} min` : "No time limit"}
            </span>
          </div>
        </div>

        {/* Instructions */}
        {exam.instructions && (
          <div className="px-6 pt-5">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Info size={14} className="text-amber-700 shrink-0" />
                <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                  Instructions
                </span>
              </div>
              <p className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">
                {exam.instructions}
              </p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleStart} className="p-6 space-y-5">
          {/* Auto-sign-in state — shown when arriving via WhatsApp magic link */}
          {prefillEmail && prefillPassword && loading && !error ? (
            <div className="flex flex-col items-center gap-3 py-4 text-muted-foreground">
              <Loader2 size={24} className="animate-spin text-primary" />
              <p className="text-sm">Signing you in…</p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Use the same email you used during enrollment.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium">
                  Exam Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password received on WhatsApp"
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/8 border border-destructive/20 px-3 py-2.5 rounded-lg">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!(prefillEmail && prefillPassword && loading && !error) && (
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Verifying…
                </>
              ) : (
                "Start Exam"
              )}
            </Button>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 pb-6 text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Not enrolled yet?{" "}
            <Link
              href={`/exam/${exam.slug}/register`}
              className="text-primary underline-offset-4 hover:underline font-medium"
            >
              Register for this exam
            </Link>
          </p>
          <p className="text-xs text-muted-foreground/70">
            By starting, you agree this exam runs in fullscreen mode and tab-switching is monitored.
          </p>
        </div>
      </div>
    </div>
  );
}
