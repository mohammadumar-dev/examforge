"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
      <Card className="w-full max-w-md p-8 space-y-6 text-center">
        {status === "loading" && (
          <>
            <div className="text-4xl">⏳</div>
            <p className="text-muted-foreground">Verifying your email…</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="text-4xl">✅</div>
            <h1 className="text-xl font-bold">Email Verified!</h1>
            <p className="text-sm text-muted-foreground">{message}</p>
            <Link href={resetLink || "/admin/login"}>
              <Button className="w-full">Set Your Password</Button>
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <div className="text-4xl">❌</div>
            <h1 className="text-xl font-bold">Verification Failed</h1>
            <p className="text-sm text-destructive">{message}</p>
            <Link href="/admin/login">
              <Button variant="outline" className="w-full">
                Back to Login
              </Button>
            </Link>
          </>
        )}
      </Card>
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
