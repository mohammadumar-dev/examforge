"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  GraduationCap,
  AlertCircle,
  Loader2,
  CheckCircle2,
  BookOpen,
  Star,
  Clock,
  CalendarClock,
} from "lucide-react";
import { LocalTime } from "@/components/LocalTime";

interface ExamInfo {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  instructions: string | null;
  timeLimitMinutes: number | null;
  scheduledStartAt: Date | string | null;
  totalMarks: number;
  _count: { questions: number };
  accessRule: { accessType: string } | null;
}

export function ExamEnrollment({ exam }: { exam: ExamInfo }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const examNotStarted =
    exam.scheduledStartAt && new Date(exam.scheduledStartAt) > new Date();

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch(`/api/exam/${exam.slug}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.toLowerCase(),
          name,
          mobileNumber,
          whatsappNumber,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Registration failed");
        return;
      }

      setSuccess(
        data.whatsappSent
          ? "Enrollment completed. Your exam password has been sent on WhatsApp."
          : "Enrollment completed. WhatsApp delivery is pending; contact the exam administrator if you do not receive your password."
      );
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-card border rounded-2xl shadow-sm overflow-hidden">
        {/* Coral gradient header */}
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 border-b p-6">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <GraduationCap size={22} className="text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight leading-snug">{exam.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">Register to take this exam</p>
              {exam.description && (
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {exam.description}
                </p>
              )}
            </div>
          </div>

          {/* Exam info pills */}
          <div className="flex flex-wrap gap-2 mt-5">
            <span className="inline-flex items-center gap-1.5 bg-background border rounded-full px-3 py-1 text-xs font-medium">
              <BookOpen size={11} className="text-primary" />
              {exam._count.questions} Questions
            </span>
            <span className="inline-flex items-center gap-1.5 bg-background border rounded-full px-3 py-1 text-xs font-medium">
              <Star size={11} className="text-primary" />
              {exam.totalMarks} Marks
            </span>
            <span className="inline-flex items-center gap-1.5 bg-background border rounded-full px-3 py-1 text-xs font-medium">
              <Clock size={11} className="text-primary" />
              {exam.timeLimitMinutes ? `${exam.timeLimitMinutes} min` : "No time limit"}
            </span>
            {exam.scheduledStartAt && (
              <span className="inline-flex items-center gap-1.5 bg-background border rounded-full px-3 py-1 text-xs font-medium">
                <CalendarClock size={11} className="text-primary" />
                Starts: <LocalTime iso={new Date(exam.scheduledStartAt).toISOString()} />
              </span>
            )}
          </div>
        </div>

        {/* Success state */}
        {success ? (
          <div className="p-6">
            <div className="text-center space-y-4 py-4">
              <div className="flex justify-center">
                <CheckCircle2 size={52} className="text-emerald-500" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold">Enrollment Complete!</h2>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                  {success}
                </p>
                {examNotStarted && exam.scheduledStartAt && (
                  <p className="text-sm text-muted-foreground mt-2">
                    The exam starts on{" "}
                    <span className="font-medium text-foreground">
                      <LocalTime iso={new Date(exam.scheduledStartAt).toISOString()} />
                    </span>
                    . Come back then with your exam password.
                  </p>
                )}
              </div>
              {!examNotStarted && (
                <Button
                  className="w-full mt-2"
                  size="lg"
                  onClick={() => router.push(`/exam/${exam.slug}`)}
                >
                  Start Exam
                </Button>
              )}
            </div>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleRegister} className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-medium">
                Full Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="mobileNumber" className="text-sm font-medium">
                  Mobile Number
                </Label>
                <Input
                  id="mobileNumber"
                  inputMode="tel"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  placeholder="+919876543210"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="whatsappNumber" className="text-sm font-medium">
                  WhatsApp Number
                </Label>
                <Input
                  id="whatsappNumber"
                  inputMode="tel"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="+919876543210"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/8 border border-destructive/20 px-3 py-2.5 rounded-lg">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Registering…
                </>
              ) : (
                "Complete Enrollment"
              )}
            </Button>

            <p className="text-sm text-muted-foreground text-center pt-1">
              Already enrolled?{" "}
              <Link
                href={`/exam/${exam.slug}`}
                className="text-primary underline-offset-4 hover:underline font-medium"
              >
                Start the exam
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
