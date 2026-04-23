"use client";

import { useEffect, useState, useCallback, useRef, useMemo, startTransition } from "react";
import { useRouter, useParams } from "next/navigation";
import { ExamTimer } from "@/components/exam/ExamTimer";
import { FullscreenGuard } from "@/components/exam/FullscreenGuard";
import { QuestionCard } from "@/components/exam/QuestionCard";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, CheckCircle2, AlertCircle } from "lucide-react";

interface Option {
  id: string;
  optionText: string;
}

interface Question {
  id: string;
  questionText: string;
  questionType: string;
  marks: number;
  orderIndex: number;
  options: Option[];
  sectionId?: string | null;
  sectionName?: string | null;
}

interface ExamSection {
  id: string | null;
  name: string | null;
  orderIndex: number;
  questions: Question[];
}

export default function ExamTakingPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [savedAnswers, setSavedAnswers] = useState<Record<string, string[]>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [error, setError] = useState("");
  const [sessionInvalidated, setSessionInvalidated] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const sessionTokenRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load session from sessionStorage
  useEffect(() => {
    const token = sessionStorage.getItem("session_token");
    const id = sessionStorage.getItem("session_id");
    const storedSlug = sessionStorage.getItem("exam_slug");

    if (!token || !id || storedSlug !== slug) {
      startTransition(() => router.replace(`/exam/${slug}`));
      return;
    }

    sessionTokenRef.current = token;
    sessionIdRef.current = id;

    // Fetch questions
    fetch(`/api/exam/${slug}/questions`, {
      headers: { "x-session-token": token },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        // Flatten sections into a single questions array with sectionName attached
        if (data.sections) {
          const flat: Question[] = (data.sections as ExamSection[]).flatMap((s) =>
            s.questions.map((q) => ({ ...q, sectionId: s.id, sectionName: s.name }))
          );
          setQuestions(flat);
        } else {
          setQuestions(data.questions ?? []);
        }
        setSavedAnswers(data.savedAnswers ?? {});
        if (data.remainingSeconds !== null && data.remainingSeconds !== undefined) {
          setRemainingSeconds(Math.floor(data.remainingSeconds));
        }
      })
      .catch(() => setError("Failed to load questions"))
      .finally(() => setLoading(false));
  }, [slug, router]);

  // Marks this window's session as invalidated (another window took over)
  const handleInvalidatedSession = useCallback(() => {
    sessionStorage.removeItem("session_token");
    sessionStorage.removeItem("session_id");
    sessionStorage.removeItem("exam_slug");
    setSessionInvalidated(true);
  }, []);

  // Heartbeat function
  const sendHeartbeat = useCallback(
    async (event: "tab_switch" | "fullscreen_exit" | "ping") => {
      const token = sessionTokenRef.current;
      if (!token || submitted) return;
      const res = await fetch(`/api/exam/${slug}/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-token": token },
        body: JSON.stringify({ event }),
      });
      if (res.status === 401) {
        handleInvalidatedSession();
      }
    },
    [slug, submitted, handleInvalidatedSession]
  );

  // Tab visibility listener
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden) {
        sendHeartbeat("tab_switch");
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [sendHeartbeat]);

  // Beforeunload listener
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!submitted) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [submitted]);

  // Auto-save answer (debounced 500ms to prevent burst POSTs on rapid clicks)
  const saveAnswer = useCallback(
    (questionId: string, optionIds: string[]) => {
      const token = sessionTokenRef.current;
      if (!token) return;

      setSavedAnswers((prev) => ({ ...prev, [questionId]: optionIds }));

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        const res = await fetch(`/api/exam/${slug}/response`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-session-token": token },
          body: JSON.stringify({ questionId, optionIds, isSkipped: optionIds.length === 0 }),
        });
        if (res.status === 401) handleInvalidatedSession();
      }, 500);
    },
    [slug, handleInvalidatedSession]
  );

  // Submit exam
  const submitExam = useCallback(async () => {
    const token = sessionTokenRef.current;
    const id = sessionIdRef.current;
    if (!token || submitted) return;

    setSubmitting(true);
    setSubmitted(true);

    try {
      const res = await fetch(`/api/exam/${slug}/submit`, {
        method: "POST",
        headers: { "x-session-token": token },
      });

      if (res.ok) {
        sessionStorage.removeItem("session_token");
        sessionStorage.removeItem("session_id");
        startTransition(() => router.push(`/exam/${slug}/result?session=${id}`));
      } else {
        const data = await res.json();
        setError(data.error ?? "Submission failed");
        setSubmitting(false);
        setSubmitted(false);
      }
    } catch {
      setError("Network error during submission. Please try again.");
      setSubmitting(false);
      setSubmitted(false);
    }
  }, [slug, router, submitted]);

  const unansweredCount = questions.filter(
    (q) => !savedAnswers[q.id] || savedAnswers[q.id].length === 0
  ).length;

  // Group questions by section for the navigation grid — recomputed only when questions change
  const sectionGroups = useMemo(() => {
    const groups: Array<{ name: string | null; indices: number[] }> = [];
    for (let i = 0; i < questions.length; i++) {
      const name = questions[i].sectionName ?? null;
      const last = groups[groups.length - 1];
      if (last && last.name === name) {
        last.indices.push(i);
      } else {
        groups.push({ name, indices: [i] });
      }
    }
    return groups;
  }, [questions]);

  const hasSections = sectionGroups.some((g) => g.name !== null);
  const currentSection = questions[currentIndex]?.sectionName ?? null;

  if (sessionInvalidated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
            <AlertTriangle size={26} className="text-amber-600" />
          </div>
          <h2 className="text-xl font-bold">Session Closed</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            This exam session was opened in another window. Only one active session is allowed per
            exam. Please use the other window to continue.
          </p>
          <Button onClick={() => router.push(`/exam/${slug}`)}>Go Back</Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 size={28} className="animate-spin text-primary" />
          <p className="text-sm">Loading your exam…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="text-center space-y-4 max-w-sm">
          <p className="text-destructive text-sm">{error}</p>
          <Button onClick={() => router.push(`/exam/${slug}`)}>Go Back</Button>
        </div>
      </div>
    );
  }

  if (submitting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 size={32} className="animate-spin text-primary" />
          <p className="font-medium text-foreground">Submitting your exam…</p>
          <p className="text-sm">Please do not close this window.</p>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];

  return (
    <>
      <FullscreenGuard onExitDetected={() => sendHeartbeat("fullscreen_exit")} />

      <div className="min-h-screen flex flex-col bg-background">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Q progress label */}
            <span className="text-sm font-bold tabular-nums">
              Q{currentIndex + 1} / {questions.length}
            </span>

            {/* Question number grid — grouped by section */}
            <div className="hidden sm:flex flex-wrap gap-x-3 gap-y-1 max-w-sm">
              {sectionGroups.map((group, gi) => (
                <div key={gi} className="flex items-center gap-1">
                  {hasSections && (
                    <span
                      className="text-xs font-semibold text-muted-foreground shrink-0 max-w-[72px] truncate"
                      title={group.name ?? "General"}
                    >
                      {group.name ?? "General"}:
                    </span>
                  )}
                  <div className="flex gap-0.5 flex-wrap">
                    {group.indices.map((i) => {
                      const q = questions[i];
                      return (
                        <button
                          key={q.id}
                          onClick={() => setCurrentIndex(i)}
                          className={`w-6 h-6 rounded text-xs font-semibold transition-colors ${
                            i === currentIndex
                              ? "bg-primary text-primary-foreground"
                              : savedAnswers[q.id]?.length > 0
                              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                              : "bg-muted text-muted-foreground hover:bg-accent"
                          }`}
                        >
                          {i + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {remainingSeconds !== null && (
            <ExamTimer totalSeconds={remainingSeconds} onExpire={submitExam} />
          )}
        </div>

        {currentSection && (
          <div className="mx-4 mt-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/8 border border-primary/20 text-sm font-semibold text-primary">
            <span className="w-1.5 h-4 rounded-full bg-primary shrink-0" />
            {currentSection}
          </div>
        )}

        {/* Question area */}
        {currentQuestion && (
          <QuestionCard
            question={currentQuestion}
            questionNumber={currentIndex + 1}
            totalQuestions={questions.length}
            savedOptionIds={savedAnswers[currentQuestion.id] ?? []}
            onAnswer={saveAnswer}
            onNext={() => setCurrentIndex((i) => Math.min(i + 1, questions.length - 1))}
            onPrev={() => setCurrentIndex((i) => Math.max(i - 1, 0))}
            onSubmit={() => setShowReview(true)}
            isFirst={currentIndex === 0}
            isLast={currentIndex === questions.length - 1}
          />
        )}
      </div>

      {/* Review modal */}
      {showReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl border shadow-xl p-6 max-w-sm w-full space-y-5">
            <h2 className="text-lg font-bold">Ready to submit?</h2>

            <div className="space-y-3">
              {/* Answered count */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                <div className="text-sm">
                  <span className="font-semibold">{questions.length - unansweredCount}</span>
                  <span className="text-muted-foreground"> of {questions.length} answered</span>
                </div>
              </div>

              {/* Unanswered count — only if > 0 */}
              {unansweredCount > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <AlertCircle size={18} className="text-amber-600 shrink-0" />
                  <div className="text-sm">
                    <span className="font-semibold text-amber-800">{unansweredCount}</span>
                    <span className="text-amber-700">
                      {" "}
                      question{unansweredCount > 1 ? "s" : ""} unanswered
                    </span>
                  </div>
                </div>
              )}
            </div>

            {unansweredCount > 0 && (
              <p className="text-xs text-muted-foreground">
                Unanswered questions will be marked as skipped.
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              Once submitted, you cannot change your answers.
            </p>

            <div className="flex flex-col gap-2">
              <Button className="w-full" size="lg" onClick={submitExam}>
                Submit Exam
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowReview(false)}
              >
                Continue Review
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
