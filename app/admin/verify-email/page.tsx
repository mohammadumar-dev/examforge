"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GraduationCap, Loader2, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [resetLink, setResetLink] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Invalid or missing verification token.");
      return;
    }

    fetch("/api/admin/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.resetLink) {
          setStatus("success");
          setMessage(data.message);
          setResetLink(data.resetLink);
        } else {
          setStatus("error");
          setMessage(data.error ?? "Verification failed");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Network error. Please try again.");
      });
  }, [token]);

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
        <Card className="w-full bg-card border rounded-2xl p-8 shadow-sm space-y-6 text-center">
          {status === "loading" && (
            <div className="flex flex-col items-center gap-4 py-4">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <div className="space-y-1">
                <h1 className="text-lg font-semibold text-foreground">Verifying your email</h1>
                <p className="text-sm text-muted-foreground">Please wait a moment…</p>
              </div>
            </div>
          )}

          {status === "success" && (
            <div className="space-y-6">
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                </div>
                <div className="space-y-1">
                  <h1 className="text-lg font-semibold text-foreground">Email Verified!</h1>
                  <p className="text-sm text-muted-foreground">{message}</p>
                </div>
              </div>

              <Link href={resetLink || "/admin/login"}>
                <Button className="w-full">Set Your Password</Button>
              </Link>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-6">
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-destructive/8 border border-destructive/20">
                  <XCircle className="w-7 h-7 text-destructive" />
                </div>
                <div className="space-y-1">
                  <h1 className="text-lg font-semibold text-foreground">Verification Failed</h1>
                  <p className="text-sm text-destructive">{message}</p>
                </div>
              </div>

              <Link href="/admin/login">
                <Button variant="outline" className="w-full gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Login
                </Button>
              </Link>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
