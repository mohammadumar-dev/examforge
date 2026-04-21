"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  UserPlus,
  CheckCircle2,
  Copy,
  Check,
  ShieldCheck,
  Clock,
} from "lucide-react";

interface AdminRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  isEmailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  createdByAdmin: { name: string } | null;
}

export default function AdminsPage() {
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [setupLink, setSetupLink] = useState("");
  const [copied, setCopied] = useState(false);

  const fetchAdmins = useCallback(async () => {
    const res = await apiFetch("/api/admin/admins");
    if (res.ok) {
      const data = await res.json();
      setAdmins(data.admins);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAdmins(); }, [fetchAdmins]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    setSetupLink("");

    const res = await apiFetch("/api/admin/auth/register", {
      method: "POST",
      json: { name, email },
    });
    const data = await res.json();

    if (res.ok) {
      setSetupLink(data.setupLink);
      setName("");
      setEmail("");
      fetchAdmins();
    } else {
      setError(data.error ?? "Failed to create admin");
    }
    setCreating(false);
  }

  function copyLink() {
    navigator.clipboard.writeText(setupLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function fmt(date: string | null) {
    if (!date) return "Never";
    return new Date(date).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  return (
    <div className="flex flex-col flex-1 p-6 gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Accounts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create new admin accounts and view existing ones
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        {/* Create admin form */}
        <div className="bg-card border rounded-xl overflow-hidden h-fit">
          <div className="flex items-center gap-3 px-5 py-4 border-b bg-muted/30">
            <div className="rounded-lg bg-primary/10 p-2">
              <UserPlus className="size-4 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">Add Admin</p>
              <p className="text-xs text-muted-foreground">
                A setup link will be generated for the new admin
              </p>
            </div>
          </div>

          <form onSubmit={handleCreate} className="p-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-name">Full Name</Label>
              <Input
                id="admin-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email</Label>
              <Input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
                required
              />
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/8 border border-destructive/20 px-3 py-2.5 rounded-lg">
                {error}
              </p>
            )}

            {setupLink && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-3 py-2.5 rounded-lg">
                  <CheckCircle2 className="size-4 shrink-0" />
                  Admin created. Share the setup link below.
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={setupLink}
                    className="text-xs font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={copyLink}
                    className="shrink-0"
                  >
                    {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  This link expires in 24 hours. The admin uses it to set their password.
                </p>
              </div>
            )}

            <div className="pt-1">
              <Button type="submit" disabled={creating} className="w-full">
                {creating ? "Creating…" : "Create Admin"}
              </Button>
            </div>
          </form>
        </div>

        {/* Admin list */}
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b bg-muted/30">
            <div className="rounded-lg bg-muted p-2">
              <ShieldCheck className="size-4 text-muted-foreground" />
            </div>
            <p className="font-semibold text-sm">All Admins</p>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : admins.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No admins found</div>
          ) : (
            <div className="divide-y">
              {admins.map((a) => (
                <div key={a.id} className="flex items-start justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{a.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.email}</p>
                    {a.createdByAdmin && (
                      <p className="text-xs text-muted-foreground/60 mt-0.5">
                        Added by {a.createdByAdmin.name}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0 text-right">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        a.isActive
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {a.isActive ? "Active" : "Inactive"}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="size-3" />
                      {fmt(a.lastLoginAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
