"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/apiClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  ListChecks,
  Phone,
  MessageCircle,
  Share2,
  Copy,
  Check,
  Trash2,
  Clock,
  Link2,
  Loader2,
} from "lucide-react";

interface EnrollmentSession {
  id: string;
  registeredAt: string;
  status: string;
  startedAt: string | null;
  submittedAt: string | null;
  timeTakenSeconds: number | null;
  score: string | null;
  totalMarks: string | null;
  percentage: string | null;
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

interface ShareToken {
  id: string;
  label: string | null;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  token?: string;
}

const sessionStatusConfig: Record<string, string> = {
  registered: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  submitted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  auto_submitted: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  expired: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
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
  if (days <= 0) return "Expired";
  if (days === 1) return "Expires tomorrow";
  return `Expires in ${days} days`;
}

function isExpiredOrRevoked(t: ShareToken) {
  return t.revokedAt !== null || new Date(t.expiresAt) < new Date();
}

function EnrollmentContent() {
  const searchParams = useSearchParams();
  const examId = searchParams.get("examId");

  const [sessions, setSessions] = useState<EnrollmentSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Share dialog state
  const [showShare, setShowShare] = useState(false);
  const [tokens, setTokens] = useState<ShareToken[]>([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState<ShareToken | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const appUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL ?? "";

  useEffect(() => {
    setLoading(true);
    setError("");
    const url = examId
      ? `/api/admin/enrollments?examId=${examId}&limit=200`
      : "/api/admin/enrollments?limit=200";

    apiFetch(url)
      .then((r) => r.json())
      .then(({ sessions }) => setSessions(sessions ?? []))
      .catch(() => setError("Failed to load enrollments"))
      .finally(() => setLoading(false));
  }, [examId]);

  const loadTokens = useCallback(() => {
    setTokensLoading(true);
    apiFetch("/api/admin/enrollment-tokens")
      .then((r) => r.json())
      .then(({ tokens }) => setTokens(tokens ?? []))
      .finally(() => setTokensLoading(false));
  }, []);

  function openShare() {
    setShowShare(true);
    setNewToken(null);
    setNewLabel("");
    loadTokens();
  }

  async function createToken() {
    setCreating(true);
    try {
      const res = await apiFetch("/api/admin/enrollment-tokens", {
        method: "POST",
        json: { label: newLabel || null },
      });
      const data = await res.json();
      if (res.ok) {
        setNewToken(data.token);
        setNewLabel("");
        loadTokens();
      }
    } finally {
      setCreating(false);
    }
  }

  async function revokeToken(id: string) {
    setRevoking(id);
    try {
      await apiFetch(`/api/admin/enrollment-tokens/${id}`, { method: "DELETE" });
      loadTokens();
      if (newToken?.id === id) setNewToken(null);
    } finally {
      setRevoking(null);
    }
  }

  async function copyLink(token: string) {
    const url = examId
      ? `${appUrl}/shared/enrollment?token=${token}&examId=${examId}`
      : `${appUrl}/shared/enrollment?token=${token}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const activeTokens = tokens.filter((t) => !isExpiredOrRevoked(t));
  const inactiveTokens = tokens.filter((t) => isExpiredOrRevoked(t));

  // Derive exam title from sessions when in single-exam mode
  const examTitle = examId && sessions.length > 0 ? sessions[0].examForm.title : null;

  const backHref = examId
    ? `/admin/dashboard/exams/${examId}`
    : "/admin/dashboard/exams";
  const backLabel = examId ? "Back to Exam" : "Back to Exams";

  return (
    <div className="flex flex-col flex-1 p-6 gap-6">
      {/* Header */}
      <div>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="size-4" />
          {backLabel}
        </Link>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {examId ? "Exam Enrollments" : "Enrollments"}
            </h1>
            {!loading && (
              <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                {sessions.length} student{sessions.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={openShare}>
            <Share2 className="size-3.5 mr-1.5" />
            Share Access
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {examId
            ? examTitle
              ? `Students enrolled in "${examTitle}"`
              : "Students enrolled in this exam"
            : "All students enrolled across all exams"}
        </p>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-destructive bg-destructive/8 border border-destructive/20 px-3 py-2.5 rounded-lg">
          {error}
        </p>
      )}

      {/* Table card */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-3">
          <div className="rounded-lg bg-muted p-2">
            <ListChecks className="size-4 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-sm">Student Enrollments</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {examId
                ? "Enrollment details for this exam"
                : "Complete enrollment details across all exams"}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="p-5 space-y-2">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No students enrolled yet
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Student</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>WhatsApp</TableHead>
                {!examId && <TableHead>Exam</TableHead>}
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
                    <p className="font-medium text-sm">{s.student.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{s.student.email}</p>
                  </TableCell>
                  <TableCell>
                    {s.student.mobileNumber ? (
                      <a
                        href={`tel:${s.student.mobileNumber}`}
                        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                      >
                        <Phone className="size-3 shrink-0" />
                        {s.student.mobileNumber}
                      </a>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {s.student.whatsappNumber ? (
                      <a
                        href={`https://wa.me/${s.student.whatsappNumber.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                      >
                        <MessageCircle className="size-3 shrink-0" />
                        {s.student.whatsappNumber}
                      </a>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  {!examId && (
                    <TableCell>
                      <Link
                        href={`/admin/dashboard/exams/${s.examForm.id}`}
                        className="text-sm font-medium hover:underline underline-offset-4"
                      >
                        {s.examForm.title}
                      </Link>
                    </TableCell>
                  )}
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
                      <span className="text-sm text-muted-foreground">—</span>
                    ) : s.isPassed ? (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        Pass
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        Fail
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatTimeTaken(s.timeTakenSeconds)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {s.startedAt
                      ? new Date(s.startedAt).toLocaleString()
                      : new Date(s.registeredAt).toLocaleString()}
                    {!s.startedAt && (
                      <span className="block text-muted-foreground/50">registered</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Share Access dialog */}
      <Dialog open={showShare} onOpenChange={setShowShare}>
        <DialogContent className="max-w-md w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="size-4 shrink-0" />
              Share Read-Only Access
            </DialogTitle>
            <DialogDescription>
              Generate a 15-day link. Anyone with it can view enrollments — no
              login required.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* ── Newly generated link ── */}
            {newToken?.token && (
              <>
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-4 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="size-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                      <Check className="size-3.5 text-white" />
                    </div>
                    <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                      Link ready — copy it now
                    </p>
                  </div>

                  <div className="bg-white dark:bg-black/20 border border-emerald-200 dark:border-emerald-700 rounded-lg p-3">
                    <p className="text-xs font-mono break-all leading-relaxed text-emerald-900 dark:text-emerald-100 select-all">
                      {appUrl}/shared/enrollment?token={newToken.token}{examId ? `&examId=${examId}` : ""}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1 shrink-0">
                      <Clock className="size-3" />
                      {daysLeft(newToken.expiresAt)}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-emerald-300 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-900/50 shrink-0"
                      onClick={() => copyLink(newToken.token!)}
                    >
                      {copied ? (
                        <>
                          <Check className="size-3.5 mr-1.5 text-emerald-600" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="size-3.5 mr-1.5" />
                          Copy Link
                        </>
                      )}
                    </Button>
                  </div>

                  <p className="text-xs text-emerald-600/70 dark:text-emerald-500">
                    This URL won't be shown again after closing.
                  </p>
                </div>

                <Separator />
              </>
            )}

            {/* ── Generate form ── */}
            <div className="space-y-2">
              <Label htmlFor="token-label" className="text-sm">
                Label{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="token-label"
                  placeholder="e.g. Principal access, Week 3 review"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && !creating && createToken()
                  }
                />
                <Button
                  onClick={createToken}
                  disabled={creating}
                  className="shrink-0"
                >
                  {creating ? (
                    <>
                      <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                      Generating…
                    </>
                  ) : (
                    "Generate"
                  )}
                </Button>
              </div>
            </div>

            {/* ── Active tokens ── */}
            {tokensLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full rounded-lg" />
                <Skeleton className="h-14 w-full rounded-lg" />
              </div>
            ) : activeTokens.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Active links · {activeTokens.length}
                </p>
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
                  {activeTokens.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-3 bg-muted/40 hover:bg-muted/70 rounded-lg px-3 py-3 transition-colors"
                    >
                      <div className="size-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Link2 className="size-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {t.label ?? "Untitled link"}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="size-3 shrink-0" />
                          {daysLeft(t.expiresAt)} ·{" "}
                          {new Date(t.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="shrink-0 h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        disabled={revoking === t.id}
                        onClick={() => revokeToken(t.id)}
                        title="Revoke link"
                      >
                        {revoking === t.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* ── Expired / revoked count ── */}
            {inactiveTokens.length > 0 && (
              <p className="text-xs text-center text-muted-foreground/60">
                +{inactiveTokens.length} expired or revoked link
                {inactiveTokens.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function EnrollmentPage() {
  return (
    <Suspense>
      <EnrollmentContent />
    </Suspense>
  );
}
