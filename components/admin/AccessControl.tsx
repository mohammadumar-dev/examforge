"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CalendarClock, CheckCircle2, Link2, Mail, Plus, Save, Send, Trash2, Users } from "lucide-react";

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface AllowedEmail {
  id: string;
  email: string;
  invitedAt: string;
  inviteSentAt: string | null;
}

interface AccessControlProps {
  examId: string;
  isPublished: boolean;
}

export function AccessControl({ examId, isPublished }: AccessControlProps) {
  const [accessType, setAccessType] = useState<"public_link" | "specific_emails">("specific_emails");
  const [emails, setEmails] = useState<AllowedEmail[]>([]);
  const [bulkEmails, setBulkEmails] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingWindow, setSavingWindow] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [registrationStartAt, setRegistrationStartAt] = useState("");
  const [registrationEndAt, setRegistrationEndAt] = useState("");

  useEffect(() => {
    Promise.all([
      apiFetch(`/api/admin/exams/${examId}/access`).then((r) => r.json()),
      apiFetch(`/api/admin/exams/${examId}/access/emails`).then((r) => r.json()),
    ])
      .then(([{ rule }, { emails }]) => {
        setAccessType(rule?.accessType ?? "specific_emails");
        setEmails(emails ?? []);
        if (rule?.registrationStartAt) {
          setRegistrationStartAt(toDatetimeLocal(rule.registrationStartAt));
        }
        if (rule?.registrationEndAt) {
          setRegistrationEndAt(toDatetimeLocal(rule.registrationEndAt));
        }
      })
      .finally(() => setLoading(false));
  }, [examId]);

  async function updateAccessType(type: "public_link" | "specific_emails") {
    setSaving(true);
    setMessage("");
    setError("");
    const res = await apiFetch(`/api/admin/exams/${examId}/access`, {
      method: "PATCH",
      json: { accessType: type },
    });
    if (res.ok) {
      setAccessType(type);
      setMessage("Access type updated");
    } else {
      setError("Failed to update access type");
    }
    setSaving(false);
  }

  async function saveRegistrationWindow() {
    setSavingWindow(true);
    setMessage("");
    setError("");
    const res = await apiFetch(`/api/admin/exams/${examId}/access`, {
      method: "PATCH",
      json: {
        registrationStartAt: registrationStartAt ? new Date(registrationStartAt).toISOString() : null,
        registrationEndAt: registrationEndAt ? new Date(registrationEndAt).toISOString() : null,
      },
    });
    if (res.ok) {
      setMessage("Registration window saved");
    } else {
      setError("Failed to save registration window");
    }
    setSavingWindow(false);
  }

  async function addEmails() {
    const emailList = bulkEmails
      .split(/[\n,;]/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes("@"));

    if (emailList.length === 0) {
      setError("No valid emails found");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    const res = await apiFetch(`/api/admin/exams/${examId}/access/emails`, {
      method: "POST",
      json: { emails: emailList },
    });
    const data = await res.json();
    if (res.ok) {
      setBulkEmails("");
      setMessage(`${data.added} email(s) added`);
      // Refresh list
      const r = await apiFetch(`/api/admin/exams/${examId}/access/emails`);
      const d = await r.json();
      setEmails(d.emails ?? []);
    } else {
      setError(data.error ?? "Failed to add emails");
    }
    setSaving(false);
  }

  async function removeEmail(email: string) {
    const res = await apiFetch(
      `/api/admin/exams/${examId}/access/emails/${encodeURIComponent(email)}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setEmails((e) => e.filter((x) => x.email !== email));
    }
  }

  async function sendInvites() {
    if (!isPublished) {
      setError("Publish the exam first before sending invites");
      return;
    }
    setInviting(true);
    setMessage("");
    setError("");
    const res = await apiFetch(`/api/admin/exams/${examId}/access/invite`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setMessage(`Invites sent to ${data.sent} student(s)`);
      const r = await apiFetch(`/api/admin/exams/${examId}/access/emails`);
      const d = await r.json();
      setEmails(d.emails ?? []);
    } else {
      setError(data.error ?? "Failed to send invites");
    }
    setInviting(false);
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-muted-foreground text-sm">Loading…</div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Access type selector */}
      <div className="bg-card border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Access Type</h3>
        <div className="grid grid-cols-2 gap-3">
          {/* Public Link card */}
          <button
            type="button"
            disabled={saving}
            onClick={() => updateAccessType("public_link")}
            className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
              accessType === "public_link"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:bg-accent/50"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                accessType === "public_link"
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <Link2 size={16} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Public Link</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Anyone with the link can take it
              </p>
            </div>
          </button>

          {/* Specific Emails card */}
          <button
            type="button"
            disabled={saving}
            onClick={() => updateAccessType("specific_emails")}
            className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
              accessType === "specific_emails"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:bg-accent/50"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                accessType === "specific_emails"
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <Users size={16} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Specific Emails</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Only whitelisted emails allowed
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Registration window */}
      <div className="bg-card border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <CalendarClock size={15} className="text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Registration Window</h3>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">
          Restrict when students can register. Leave blank to allow registration whenever the exam is published.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Opens at</label>
            <Input
              type="datetime-local"
              value={registrationStartAt}
              onChange={(e) => setRegistrationStartAt(e.target.value)}
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Closes at</label>
            <Input
              type="datetime-local"
              value={registrationEndAt}
              onChange={(e) => setRegistrationEndAt(e.target.value)}
              className="text-sm"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={saveRegistrationWindow}
            disabled={savingWindow}
          >
            <Save size={13} className="mr-1.5" />
            {savingWindow ? "Saving…" : "Save Window"}
          </Button>
          {(registrationStartAt || registrationEndAt) && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-destructive transition-colors"
              onClick={() => {
                setRegistrationStartAt("");
                setRegistrationEndAt("");
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Email management */}
      {accessType === "specific_emails" && (
        <>
          {/* Add Emails */}
          <div className="bg-card border rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Add Emails</h3>
            <Textarea
              value={bulkEmails}
              onChange={(e) => setBulkEmails(e.target.value)}
              placeholder={
                "Paste emails — one per line, or comma/semicolon separated\n\nalice@example.com\nbob@example.com, carol@example.com"
              }
              rows={5}
              className="resize-none font-mono text-sm"
            />
            <Button
              size="sm"
              onClick={addEmails}
              disabled={saving || !bulkEmails.trim()}
            >
              <Plus size={14} className="mr-1.5" />
              {saving ? "Adding…" : "Add Emails"}
            </Button>
          </div>

          {/* Email list */}
          <div className="bg-card border rounded-xl p-5 space-y-4">
            {/* Action bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">Allowed Emails</h3>
                {emails.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                    {emails.length}
                  </span>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={sendInvites}
                disabled={inviting || emails.length === 0}
              >
                <Send size={13} className="mr-1.5" />
                {inviting ? "Sending…" : "Send Invites"}
              </Button>
            </div>

            {emails.length === 0 ? (
              <div className="py-8 flex flex-col items-center gap-2 text-center">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <Mail size={18} className="text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No emails added yet</p>
              </div>
            ) : (
              <div className="space-y-1 max-h-72 overflow-y-auto -mx-1 px-1">
                {emails.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-accent/40 transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Mail size={13} className="text-muted-foreground shrink-0" />
                      <span className="text-sm truncate text-foreground">{e.email}</span>
                      {e.inviteSentAt && (
                        <Badge
                          variant="secondary"
                          className="text-xs shrink-0 bg-emerald-100 text-emerald-700 border-0"
                        >
                          Invited
                        </Badge>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeEmail(e.email)}
                      className="opacity-0 group-hover:opacity-100 ml-2 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all shrink-0"
                      aria-label={`Remove ${e.email}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Feedback */}
      {message && (
        <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2.5 rounded-lg flex items-center gap-2">
          <CheckCircle2 size={15} className="shrink-0" />
          {message}
        </div>
      )}
      {error && (
        <div className="text-sm text-destructive bg-destructive/8 border border-destructive/20 px-3 py-2.5 rounded-lg flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
