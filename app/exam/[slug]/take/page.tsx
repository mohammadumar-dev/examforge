"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { ExamTimer } from "@/components/exam/ExamTimer";
import { FullscreenGuard } from "@/components/exam/FullscreenGuard";
import { QuestionCard } from "@/components/exam/QuestionCard";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

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

  // Load session from sessionStorage
  useEffect(() => {
    const token = sessionStorage.getItem("session_token");
    const id = sessionStorage.getItem("session_id");
    const storedSlug = sessionStorage.getItem("exam_slug");

    if (!token || !id || storedSlug !== slug) {
      router.replace(`/exam/${slug}`);
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
        setQuestions(data.questions ?? []);
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

  // Auto-save answer
  const saveAnswer = useCallback(
    async (questionId: string, optionIds: string[]) => {
      const token = sessionTokenRef.current;
      if (!token) return;

      setSavedAnswers((prev) => ({ ...prev, [questionId]: optionIds }));

      const res = await fetch(`/api/exam/${slug}/response`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-token": token },
        body: JSON.stringify({
          questionId,
          optionIds,
          isSkipped: optionIds.length === 0,
        }),
      });
      if (res.status === 401) {
        handleInvalidatedSession();
      }
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
        router.push(`/exam/${slug}/result?session=${id}`);
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

  if (sessionInvalidated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="text-center space-y-4 max-w-sm">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-xl font-bold">Session Closed</h2>
          <p className="text-muted-foreground text-sm">
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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error}</p>
          <Button onClick={() => router.push(`/exam/${slug}`)}>Go Back</Button>
        </div>
      </div>
    );
  }

  if (submitting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 size={32} className="animate-spin mx-auto" />
          <p className="font-medium">Submitting your exam…</p>
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
        <div className="border-b px-4 py-3 flex items-center justify-between bg-card sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">
              {currentIndex + 1} / {questions.length}
            </span>
            <div className="hidden sm:flex gap-1 flex-wrap max-w-sm">
              {questions.map((q, i) => (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(i)}
                  className={`w-6 h-6 rounded text-xs font-medium transition-colors ${
                    i === currentIndex
                      ? "bg-primary text-primary-foreground"
                      : savedAnswers[q.id]?.length > 0
                      ? "bg-green-100 text-green-700"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>

          {remainingSeconds !== null && (
            <ExamTimer totalSeconds={remainingSeconds} onExpire={submitExam} />
          )}
        </div>

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full space-y-4">
            <h2 className="text-lg font-bold">Ready to submit?</h2>
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-medium">Answered:</span>{" "}
                {questions.length - unansweredCount} / {questions.length}
              </p>
              {unansweredCount > 0 && (
                <p className="text-amber-600 font-medium">
                  ⚠️ {unansweredCount} question{unansweredCount > 1 ? "s" : ""} unanswered
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Once submitted, you cannot change your answers.
            </p>
            <div className="flex gap-3">
              <Button className="flex-1" onClick={submitExam}>
                Submit Exam
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setShowReview(false)}>
                Review
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
