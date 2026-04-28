"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Phone, MessageCircle, Clock, ListChecks, ShieldAlert } from "lucide-react";

interface EnrollmentSession {
  id: string;
  status: string;
  startedAt: string;
  timeTakenSeconds: number | null;
  score: string | null;
  totalMarks: string | null;
  isPassed: boolean | null;
  student: {
    id: string;
    email: string;
    name: string | null;
    mobileNumber: string | null;
    whatsappNumber: string | null;
  };
  examForm: { id: string; title: string; slug: string };
}

const sessionStatusConfig: Record<string, string> = {
  in_progress: "bg-blue-100 text-blue-700",
  submitted: "bg-emerald-100 text-emerald-700",
  auto_submitted: "bg-amber-100 text-amber-700",
  expired: "bg-red-100 text-red-700",
};

function formatTimeTaken(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function daysLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return "expired";
  if (days === 1) return "expires tomorrow";
  return `expires in ${days} days`;
}

function EnrollmentView() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [sessions, setSessions] = useState<EnrollmentSession[]>([]);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("No access token provided.");
      setLoading(false);
      return;
    }

    fetch(`/api/shared/enrollment?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Access denied");
        setSessions(data.sessions ?? []);
        setExpiresAt(data.expiresAt);
        setLabel(data.label);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="p-5 space-y-2">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-6 text-center">
        <div className="rounded-full bg-red-100 p-4">
          <ShieldAlert className="size-8 text-red-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900">Access Denied</h2>
        <p className="text-sm text-gray-500 max-w-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top banner */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-gray-100 p-2">
            <ListChecks className="size-4 text-gray-600" />
          </div>
          <div>
            <p className="font-semibold text-sm">
              {label ? label : "Student Enrollments"} — Read-only view
            </p>
            <p className="text-xs text-gray-500">
              All students enrolled across all exams
            </p>
          </div>
        </div>
        {expiresAt && (
          <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">
            <Clock className="size-3" />
            This link {daysLeft(expiresAt)}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="p-6">
        <div className="bg-white border rounded-xl overflow-hidden">
          {sessions.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-500">
              No students enrolled yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Student</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Exam</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Time Taken</TableHead>
                  <TableHead>Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="pl-5">
                      <p className="font-medium text-sm">
                        {s.student.name ?? "—"}
                      </p>
                      <p className="text-xs text-gray-500">{s.student.email}</p>
                    </TableCell>
                    <TableCell>
                      {s.student.mobileNumber ? (
                        <a
                          href={`tel:${s.student.mobileNumber}`}
                          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
                        >
                          <Phone className="size-3 shrink-0" />
                          {s.student.mobileNumber}
                        </a>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {s.student.whatsappNumber ? (
                        <a
                          href={`https://wa.me/${s.student.whatsappNumber.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700"
                        >
                          <MessageCircle className="size-3 shrink-0" />
                          {s.student.whatsappNumber}
                        </a>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {s.examForm.title}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${sessionStatusConfig[s.status] ?? ""}`}
                      >
                        {s.status.replace(/_/g, " ")}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {s.score != null && s.totalMarks != null
                        ? `${s.score} / ${s.totalMarks}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {s.isPassed === null ? (
                        <span className="text-sm text-gray-400">—</span>
                      ) : s.isPassed ? (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700">
                          Pass
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">
                          Fail
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {formatTimeTaken(s.timeTakenSeconds)}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">
                      {new Date(s.startedAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <p className="text-xs text-center text-gray-400 mt-4">
          Read-only · {sessions.length} student{sessions.length !== 1 ? "s" : ""} ·
          Powered by HI Tech Examination
        </p>
      </div>
    </div>
  );
}

export default function SharedEnrollmentPage() {
  return (
    <Suspense>
      <EnrollmentView />
    </Suspense>
  );
}
