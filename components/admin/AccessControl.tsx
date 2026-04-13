"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Trash2, Mail, Link2, Users } from "lucide-react";

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
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      apiFetch(`/api/admin/exams/${examId}/access`).then((r) => r.json()),
      apiFetch(`/api/admin/exams/${examId}/access/emails`).then((r) => r.json()),
    ])
      .then(([{ rule }, { emails }]) => {
        setAccessType(rule?.accessType ?? "specific_emails");
        setEmails(emails ?? []);
      })
      .finally(() => setLoading(false));
  }, [examId]);

  async function updateAccessType(type: "public_link" | "specific_emails") {
    setSaving(true);
    setMessage("");
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

  if (loading) return <div className="py-8 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      {/* Access type toggle */}
      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="font-semibold text-sm">Access Type</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => updateAccessType("public_link")}
            className={`flex items-center gap-3 p-3 rounded-lg border text-sm ${
              accessType === "public_link"
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-accent/50"
            }`}
          >
            <Link2 size={16} />
            <div className="text-left">
              <p className="font-medium">Public Link</p>
              <p className="text-xs text-muted-foreground">Anyone with the link can take it</p>
            </div>
          </button>
          <button
            onClick={() => updateAccessType("specific_emails")}
            className={`flex items-center gap-3 p-3 rounded-lg border text-sm ${
              accessType === "specific_emails"
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-accent/50"
            }`}
          >
            <Users size={16} />
            <div className="text-left">
              <p className="font-medium">Specific Emails</p>
              <p className="text-xs text-muted-foreground">Only whitelisted emails allowed</p>
            </div>
          </button>
        </div>
      </div>

      {/* Email management (shown for specific_emails) */}
      {accessType === "specific_emails" && (
        <>
          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-sm">Add Allowed Emails</h3>
            <Textarea
              value={bulkEmails}
              onChange={(e) => setBulkEmails(e.target.value)}
              placeholder="Paste emails — one per line, or comma/semicolon separated"
              rows={4}
            />
            <Button size="sm" onClick={addEmails} disabled={saving}>
              Add Emails
            </Button>
          </div>

          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">
                Allowed Emails <span className="text-muted-foreground">({emails.length})</span>
              </h3>
              <Button
                size="sm"
                variant="outline"
                onClick={sendInvites}
                disabled={inviting || emails.length === 0}
              >
                <Mail size={14} className="mr-1" />
                {inviting ? "Sending…" : "Send Invites"}
              </Button>
            </div>

            {emails.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No emails added yet</p>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {emails.map((e) => (
                  <div key={e.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-accent/30 group">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{e.email}</span>
                      {e.inviteSentAt && (
                        <Badge variant="secondary" className="text-xs">Invited</Badge>
                      )}
                    </div>
                    <button
                      onClick={() => removeEmail(e.email)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {message && (
        <p className="text-sm bg-green-50 text-green-800 border border-green-200 px-3 py-2 rounded-md">
          {message}
        </p>
      )}
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
      )}
    </div>
  );
}
