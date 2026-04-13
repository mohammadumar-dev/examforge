"use client";

import { CheckCircle, XCircle, Clock, RotateCcw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface ResultData {
  sessionId: string;
  status: string;
  score: number;
  totalMarks: number;
  percentage: number;
  isPassed: boolean;
  timeTakenSeconds: number | null;
  submittedAt: string;
  student: { email: string; name: string | null };
  responses?: ResponseData[];
}

interface ResponseData {
  question: {
    id: string;
    questionText: string;
    explanation?: string;
    options: { id: string; optionText: string; isCorrect: boolean }[];
  };
  isCorrect: boolean | null;
  marksAwarded: number | null;
  isSkipped: boolean;
  selectedOptions: { option: { id: string; optionText: string; isCorrect: boolean } }[];
}

export function ResultCard({ result, examTitle }: { result: ResultData; examTitle?: string }) {
  const minutes = result.timeTakenSeconds ? Math.floor(result.timeTakenSeconds / 60) : 0;
  const seconds = result.timeTakenSeconds ? result.timeTakenSeconds % 60 : 0;

  return (
    <div className="min-h-screen bg-background p-4 flex items-start justify-center">
      <div className="w-full max-w-2xl space-y-6 py-8">
        {/* Result header */}
        <div
          className={`border rounded-xl p-8 text-center space-y-4 ${
            result.isPassed
              ? "bg-green-50 border-green-200"
              : "bg-red-50 border-red-200"
          }`}
        >
          {result.isPassed ? (
            <CheckCircle size={48} className="text-green-500 mx-auto" />
          ) : (
            <XCircle size={48} className="text-red-500 mx-auto" />
          )}

          <h1 className="text-2xl font-bold">
            {result.isPassed ? "Congratulations!" : "Better luck next time"}
          </h1>
          {examTitle && <p className="text-muted-foreground text-sm">{examTitle}</p>}

          <div className="text-5xl font-bold">
            {Number(result.percentage).toFixed(1)}%
          </div>

          <p className="text-muted-foreground">
            Score: {Number(result.score)} / {Number(result.totalMarks)}
          </p>

          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Clock size={14} />
            Time taken: {minutes}m {seconds}s
          </div>

          <div
            className={`inline-block px-4 py-1 rounded-full text-sm font-semibold ${
              result.isPassed
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {result.isPassed ? "PASSED" : "FAILED"}
          </div>
        </div>

        {/* Answer review */}
        {result.responses && result.responses.length > 0 && (
          <div className="space-y-4">
            <h2 className="font-bold text-lg">Answer Review</h2>
            {result.responses.map((r, i) => (
              <div
                key={r.question.id}
                className={`border rounded-lg p-4 space-y-3 ${
                  r.isCorrect
                    ? "border-green-200 bg-green-50/50"
                    : r.isSkipped
                    ? "border-zinc-200"
                    : "border-red-200 bg-red-50/50"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-xs text-muted-foreground shrink-0 mt-0.5">Q{i + 1}</span>
                  <p className="text-sm font-medium">{r.question.questionText}</p>
                  {r.isCorrect === true && (
                    <CheckCircle size={14} className="text-green-500 shrink-0 mt-0.5" />
                  )}
                  {r.isCorrect === false && (
                    <XCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                  )}
                </div>

                {r.isSkipped ? (
                  <p className="text-xs text-muted-foreground">Skipped</p>
                ) : (
                  <div className="space-y-1">
                    {r.question.options.map((opt) => {
                      const wasSelected = r.selectedOptions.some((s) => s.option.id === opt.id);
                      return (
                        <div
                          key={opt.id}
                          className={`text-xs px-3 py-1.5 rounded flex items-center gap-2 ${
                            opt.isCorrect
                              ? "bg-green-100 text-green-800"
                              : wasSelected && !opt.isCorrect
                              ? "bg-red-100 text-red-800"
                              : "text-muted-foreground"
                          }`}
                        >
                          {wasSelected && <Check size={10} className="shrink-0" />}
                          {opt.optionText}
                          {opt.isCorrect && <span className="ml-auto font-medium">✓ Correct</span>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {r.question.explanation && (
                  <p className="text-xs text-blue-700 bg-blue-50 px-3 py-2 rounded">
                    💡 {r.question.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Check({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
