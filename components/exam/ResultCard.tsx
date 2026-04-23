"use client";

import { CheckCircle, XCircle, Clock, Trophy, Target, Lightbulb, Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface SectionBreakdownItem {
  sectionId: string | null;
  sectionName: string | null;
  orderIndex: number;
  score: number;
  totalMarks: number;
  correct: number;
  total: number;
  skipped: number;
}

export interface ResultData {
  sessionId: string;
  status: string;
  score: number;
  totalMarks: number;
  percentage: number;
  isPassed: boolean;
  timeTakenSeconds: number | null;
  submittedAt: string;
  resultShareToken?: string | null;
  student: { email: string; name: string | null };
  responses?: ResponseData[];
  sectionBreakdown?: SectionBreakdownItem[];
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

export function ResultCard({ result, examTitle, slug, pdfToken }: { result: ResultData; examTitle?: string; slug?: string; pdfToken?: string }) {
  const pdfUrl = slug && pdfToken
    ? `/api/exam/${slug}/result/${result.sessionId}/pdf?token=${pdfToken}`
    : null;
  const minutes = result.timeTakenSeconds ? Math.floor(result.timeTakenSeconds / 60) : 0;
  const seconds = result.timeTakenSeconds ? result.timeTakenSeconds % 60 : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Result hero */}
      <div
        className={`border-b ${
          result.isPassed
            ? "bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200"
            : "bg-gradient-to-br from-red-50 to-red-100/50 border-red-200"
        }`}
      >
        <div className="max-w-2xl mx-auto px-4 py-12 text-center space-y-4">
          {/* Icon */}
          <div className="flex justify-center">
            {result.isPassed ? (
              <Trophy size={52} className="text-emerald-500" />
            ) : (
              <Target size={52} className="text-red-400" />
            )}
          </div>

          {/* Percentage */}
          <div className="text-6xl font-bold tracking-tight">
            {Number(result.percentage).toFixed(1)}%
          </div>

          {/* Score fraction */}
          <p className="text-muted-foreground font-medium">
            {Number(result.score)} / {Number(result.totalMarks)} marks
          </p>

          {/* Time */}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Clock size={14} />
            <span>
              {minutes}m {seconds}s
            </span>
          </div>

          {/* Exam title */}
          {examTitle && (
            <p className="text-sm text-muted-foreground">{examTitle}</p>
          )}

          {/* Pass/fail badge */}
          <div>
            <span
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold tracking-wide ${
                result.isPassed
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                  : "bg-red-100 text-red-800 border border-red-200"
              }`}
            >
              {result.isPassed ? (
                <CheckCircle size={14} />
              ) : (
                <XCircle size={14} />
              )}
              {result.isPassed ? "PASSED" : "FAILED"}
            </span>
          </div>

          {/* Download PDF */}
          {pdfUrl && (
            <div>
              <Button asChild variant="outline" size="sm" className="gap-2">
                <a href={pdfUrl} download>
                  <Download size={14} />
                  Download Result PDF
                </a>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Section-wise breakdown */}
      {result.sectionBreakdown && result.sectionBreakdown.length > 0 && (
        <div className="max-w-2xl mx-auto px-4 py-8">
          <h2 className="text-lg font-bold mb-4">Section-wise Breakdown</h2>
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/60 text-muted-foreground text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-semibold">Section</th>
                  <th className="text-center px-4 py-3 font-semibold">Score</th>
                  <th className="text-center px-4 py-3 font-semibold">Correct</th>
                  <th className="text-center px-4 py-3 font-semibold">Skipped</th>
                  <th className="text-right px-4 py-3 font-semibold">%</th>
                </tr>
              </thead>
              <tbody>
                {result.sectionBreakdown.map((s, i) => {
                  const pct = s.totalMarks > 0 ? ((s.score / s.totalMarks) * 100).toFixed(1) : "0.0";
                  return (
                    <tr key={s.sectionId ?? i} className={i % 2 === 0 ? "bg-card" : "bg-muted/30"}>
                      <td className="px-4 py-3 font-medium">{s.sectionName ?? "General"}</td>
                      <td className="px-4 py-3 text-center tabular-nums">
                        {s.score} / {s.totalMarks}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums text-emerald-600 font-medium">
                        {s.correct} / {s.total}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums text-muted-foreground">
                        {s.skipped}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Answer review */}
      {result.responses && result.responses.length > 0 && (
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
          <h2 className="text-lg font-bold mb-6">Answer Review</h2>

          {result.responses.map((r, i) => (
            <div
              key={r.question.id}
              className={`bg-card border rounded-xl p-5 space-y-4 ${
                r.isSkipped
                  ? "border-l-4 border-l-zinc-300"
                  : r.isCorrect
                  ? "border-l-4 border-l-emerald-400"
                  : "border-l-4 border-l-red-400"
              }`}
            >
              {/* Question row */}
              <div className="flex items-start gap-3">
                <span className="text-xs text-muted-foreground font-medium bg-muted px-2 py-0.5 rounded-md shrink-0 mt-0.5">
                  Q{i + 1}
                </span>
                <p className="text-sm font-medium leading-relaxed flex-1">
                  {r.question.questionText}
                </p>
                {r.isCorrect === true && (
                  <CheckCircle size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                )}
                {r.isCorrect === false && (
                  <XCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                )}
              </div>

              {/* Options as pill chips */}
              {r.isSkipped ? (
                <p className="text-xs text-muted-foreground italic">Skipped</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {r.question.options.map((opt, optIdx) => {
                    const wasSelected = r.selectedOptions.some((s) => s.option.id === opt.id);
                    const isCorrect = opt.isCorrect;
                    const isWrongSelected = wasSelected && !isCorrect;
                    const label = String.fromCharCode(65 + optIdx); // A, B, C, D …

                    return (
                      <span
                        key={opt.id}
                        className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium ${
                          isCorrect
                            ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                            : isWrongSelected
                            ? "bg-red-100 text-red-800 border-red-200"
                            : "bg-muted text-muted-foreground border-transparent"
                        }`}
                      >
                        <span className="font-bold">{label}.</span>
                        {wasSelected && <Check size={10} strokeWidth={3} />}
                        {opt.optionText}
                        {isCorrect && (
                          <span className="font-semibold ml-0.5">&#10003;</span>
                        )}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Explanation */}
              {r.question.explanation && (
                <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                  <Lightbulb size={13} className="text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-700 leading-relaxed">{r.question.explanation}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
