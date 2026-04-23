"use client";

import { useState, useEffect, Suspense, startTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { KeyRound, AlertCircle, Eye, EyeOff, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!token) setError("Invalid or missing reset token.");
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Reset failed");
        return;
      }
      setSuccess(true);
      setTimeout(() => startTransition(() => router.push("/admin/login")), 2000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand header — KeyRound icon for this page */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary">
            <KeyRound className="w-6 h-6 text-primary-foreground" />
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-foreground">HI Tech Examination</p>
            <p className="text-sm text-muted-foreground">Admin</p>
          </div>
        </div>

        {/* Card */}
        <Card className="w-full bg-card border rounded-2xl p-8 shadow-sm space-y-6">
          {success ? (
            <div className="space-y-4 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                </div>
                <h1 className="text-lg font-semibold text-foreground">Password reset!</h1>
              </div>
              <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2.5 rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Password reset successfully. Redirecting to login…</span>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <h1 className="text-lg font-semibold tracking-tight text-foreground">Set new password</h1>
                <p className="text-sm text-muted-foreground">Choose a strong password for your account</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Min 8 chars, uppercase, number"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="confirm"
                      type={showConfirm ? "text" : "password"}
                      placeholder="Repeat password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                      aria-label={showConfirm ? "Hide password" : "Show password"}
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="text-sm text-destructive bg-destructive/8 border border-destructive/20 px-3 py-2.5 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={loading || !token}>
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Resetting…
                    </>
                  ) : (
                    "Reset Password"
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

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
