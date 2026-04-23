"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { GraduationCap, AlertCircle, Loader2, MailCheck, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Something went wrong");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand header */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary">
            <GraduationCap className="w-6 h-6 text-primary-foreground" />
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-foreground">HI Tech Examination</p>
            <p className="text-sm text-muted-foreground">Admin</p>
          </div>
        </div>

        {/* Card */}
        <Card className="w-full bg-card border rounded-2xl p-8 shadow-sm space-y-6">
          {submitted ? (
            <div className="space-y-6 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <MailCheck className="w-7 h-7 text-emerald-600" />
                </div>
                <div className="space-y-1">
                  <h1 className="text-lg font-semibold text-foreground">Check your inbox</h1>
                  <p className="text-sm text-muted-foreground">Reset link sent</p>
                </div>
              </div>

              <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2.5 rounded-lg flex items-center gap-2">
                <MailCheck className="w-4 h-4 shrink-0" />
                <span>If that email exists, a password reset link has been sent. Check your inbox.</span>
              </div>

              <Link href="/admin/login">
                <Button variant="outline" className="w-full gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Login
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <h1 className="text-lg font-semibold tracking-tight text-foreground">Reset your password</h1>
                <p className="text-sm text-muted-foreground">
                  Enter your admin email to receive a reset link
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                {error && (
                  <div className="text-sm text-destructive bg-destructive/8 border border-destructive/20 px-3 py-2.5 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    "Send Reset Link"
                  )}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground">
                <Link href="/admin/login" className="hover:text-foreground underline underline-offset-4 transition-colors">
                  Back to login
                </Link>
              </p>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
