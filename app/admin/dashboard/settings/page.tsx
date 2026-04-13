"use client";

import { useState } from "react";
import { useAuth } from "@/components/admin/AuthProvider";
import { apiFetch } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export default function SettingsPage() {
  const { admin } = useAuth();
  const [name, setName] = useState(admin?.name ?? "");
  const [email, setEmail] = useState(admin?.email ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    const res = await apiFetch("/api/admin/me", {
      method: "PATCH",
      json: { name, email },
    });
    const data = await res.json();

    if (res.ok) {
      setMessage("Profile updated");
    } else {
      setError(data.error ?? "Update failed");
    }
    setSaving(false);
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your admin profile</p>
      </div>

      <Card className="p-6">
        <h2 className="font-semibold mb-4">Profile</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          {message && (
            <p className="text-sm bg-green-50 text-green-800 border border-green-200 px-3 py-2 rounded-md">
              {message}
            </p>
          )}
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
          )}

          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold mb-2">Change Password</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Use the forgot password flow to change your password securely.
        </p>
        <a href="/admin/forgot-password" className="text-sm underline hover:no-underline">
          Send password reset email →
        </a>
      </Card>
    </div>
  );
}
