"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

function RegisterContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-8 space-y-4 text-center">
        <div className="text-4xl">🔐</div>
        <h1 className="text-xl font-bold">Admin Registration</h1>
        <p className="text-sm text-muted-foreground">
          Admin accounts are created by existing admins. If you were invited, you will receive a
          verification email with a link to set your password.
        </p>
        <p className="text-sm text-muted-foreground">
          After verifying your email, you will be redirected to set your password.
        </p>
        <Link href="/admin/login">
          <Button variant="outline" className="w-full">
            Go to Login
          </Button>
        </Link>
      </Card>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterContent />
    </Suspense>
  );
}
