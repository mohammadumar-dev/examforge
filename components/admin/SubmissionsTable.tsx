"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Clock, CheckCircle, XCircle } from "lucide-react";

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
  expired: { label: "Expired", class: "bg-zinc-100 text-zinc-700" },
};

export function SubmissionsTable({ sessions, analytics, examId }: SubmissionsTableProps) {
  return (
    <div className="space-y-6">
      {/* Analytics cards */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="border rounded-lg p-4">
            <p className="text-xs text-muted-foreground">Total Submissions</p>
            <p className="text-2xl font-bold mt-1">{analytics.total}</p>
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-xs text-muted-foreground">Pass Rate</p>
            <p className="text-2xl font-bold mt-1">{analytics.passRate}%</p>
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-xs text-muted-foreground">Avg Score</p>
            <p className="text-2xl font-bold mt-1">{analytics.avgScore}%</p>
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-xs text-muted-foreground">Avg Time</p>
            <p className="text-2xl font-bold mt-1">{formatTime(analytics.avgTimeSeconds)}</p>
          </div>
        </div>
      )}

      {sessions.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground">No submissions yet</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Student</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Score</th>
                <th className="text-right px-4 py-3">Time</th>
                <th className="text-right px-4 py-3">Security</th>
                <th className="text-right px-4 py-3">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sessions.map((session) => {
                const badge = statusBadge[session.status];
                return (
                  <tr key={session.id} className="hover:bg-accent/30">
                    <td className="px-4 py-3">
                      <p className="font-medium">{session.student.email}</p>
                      {session.student.name && (
                        <p className="text-xs text-muted-foreground">{session.student.name}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${badge?.class}`}>
                          {badge?.label ?? session.status}
                        </span>
                        {session.isPassed === true && <CheckCircle size={14} className="text-green-500" />}
                        {session.isPassed === false && <XCircle size={14} className="text-red-500" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {session.score !== null ? (
                        <span>
                          {Number(session.score)}/{Number(session.totalMarks)}
                          <span className="text-muted-foreground ml-1 text-xs">
                            ({Number(session.percentage).toFixed(0)}%)
                          </span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {formatTime(session.timeTakenSeconds)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {session.tabSwitchCount > 0 && (
                        <span className="text-xs text-amber-600 mr-2">
                          {session.tabSwitchCount} tab switch
                        </span>
                      )}
                      {session.fullscreenExitCount > 0 && (
                        <span className="text-xs text-amber-600">
                          {session.fullscreenExitCount} fullscreen exit
                        </span>
                      )}
                      {session.tabSwitchCount === 0 && session.fullscreenExitCount === 0 && (
                        <span className="text-xs text-green-600">Clean</span>
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
