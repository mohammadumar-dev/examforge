"use client";

import { useState } from "react";
import { CheckCircle, XCircle, ClipboardList, Download, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";

interface Session {
  id: string;
  status: string;
  score: number | null;
  totalMarks: number | null;
  percentage: number | null;
  isPassed: boolean | null;
  timeTakenSeconds: number | null;
  startedAt: string;
  submittedAt: string | null;
  tabSwitchCount: number;
  fullscreenExitCount: number;
  student: { id: string; email: string; name: string | null };
}

interface Analytics {
  total: number;
  inProgress: number;
  passed: number;
  failed: number;
  passRate: number;
  avgScore: number;
  avgTimeSeconds: number | null;
  autoSubmitted: number;
}

interface SubmissionsTableProps {
  sessions: Session[];
  analytics: Analytics | null;
  examId: string;
}

function formatTime(seconds: number | null) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

const statusBadge: Record<string, { label: string; class: string }> = {
  submitted: { label: "Submitted", class: "bg-green-100 text-green-700" },
  auto_submitted: { label: "Auto-submitted", class: "bg-amber-100 text-amber-700" },
  in_progress: { label: "In Progress", class: "bg-blue-100 text-blue-700" },
  expired: { label: "Expired", class: "bg-zinc-100 text-zinc-600" },
};

const analyticsCards = [
  {
    key: "total" as const,
    label: "Total Submissions",
    sublabel: (a: Analytics) =>
      a.inProgress > 0 ? `${a.inProgress} in progress` : "all sessions",
    accent: "border-l-blue-400",
    value: (a: Analytics) => String(a.total),
  },
  {
    key: "passRate" as const,
    label: "Pass Rate",
    sublabel: (a: Analytics) => `${a.passed} passed · ${a.failed} failed`,
    accent: "border-l-emerald-400",
    value: (a: Analytics) => `${a.passRate}%`,
  },
  {
    key: "avgScore" as const,
    label: "Avg Score",
    sublabel: () => "across submitted sessions",
    accent: "border-l-amber-400",
    value: (a: Analytics) => `${a.avgScore}%`,
  },
  {
    key: "avgTimeSeconds" as const,
    label: "Avg Time",
    sublabel: (a: Analytics) =>
      a.autoSubmitted > 0 ? `${a.autoSubmitted} auto-submitted` : "time on exam",
    accent: "border-l-purple-400",
    value: (a: Analytics) => formatTime(a.avgTimeSeconds),
  },
];

export function SubmissionsTable({ sessions, analytics, examId }: SubmissionsTableProps) {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await apiFetch(`/api/admin/exams/${examId}/submissions/export`);
      if (!res.ok) { setExporting(false); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="(.+?)"/);
      a.href = url;
      a.download = match?.[1] ?? "submissions.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Analytics cards */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {analyticsCards.map((card) => (
            <div
              key={card.key}
              className={`bg-card border rounded-xl p-5 border-l-4 ${card.accent}`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {card.label}
              </p>
              <p className="text-2xl font-bold mt-2 text-foreground">{card.value(analytics)}</p>
              <p className="text-xs text-muted-foreground mt-1">{card.sublabel(analytics)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table header row with export button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {sessions.length} session{sessions.length !== 1 ? "s" : ""}
        </p>
        {sessions.length > 0 && (
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting
              ? <Loader2 size={15} className="animate-spin" />
              : <Download size={15} />
            }
            {exporting ? "Exporting…" : "Export XLSX"}
          </button>
        )}
      </div>

      {sessions.length === 0 ? (
        <div className="bg-card border rounded-xl py-16 flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <ClipboardList size={22} className="text-muted-foreground" />
          </div>
          <p className="font-medium text-foreground">No submissions yet</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Once students complete this exam, their results will appear here.
          </p>
        </div>
      ) : (
        <div className="bg-card border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Student
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Status
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Score
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Time
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Security
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Submitted
                </th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => {
                const badge = statusBadge[session.status];
                const isClean =
                  session.tabSwitchCount === 0 && session.fullscreenExitCount === 0;

                return (
                  <tr
                    key={session.id}
                    className="hover:bg-accent/30 transition-colors border-b last:border-0"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground">{session.student.email}</p>
                      {session.student.name && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {session.student.name}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge?.class ?? "bg-zinc-100 text-zinc-600"}`}
                        >
                          {badge?.label ?? session.status}
                        </span>
                        {session.isPassed === true && (
                          <CheckCircle size={14} className="text-emerald-500" />
                        )}
                        {session.isPassed === false && (
                          <XCircle size={14} className="text-red-500" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {session.score !== null ? (
                        <span className="font-medium text-foreground">
                          {Number(session.score)}/{Number(session.totalMarks)}
                          <span className="text-muted-foreground ml-1 text-xs font-normal">
                            ({Number(session.percentage).toFixed(0)}%)
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {formatTime(session.timeTakenSeconds)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isClean ? (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700">
                          Clean
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {session.tabSwitchCount > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                              {session.tabSwitchCount} tab switch
                            </span>
                          )}
                          {session.fullscreenExitCount > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                              {session.fullscreenExitCount} fullscreen exit
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                      {session.submittedAt
                        ? new Date(session.submittedAt).toLocaleString()
                        : "In progress"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
