import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdminAuth } from "@/lib/withAdminAuth";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

function fmtTime(seconds: number | null): string {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function fmtDate(d: Date | string | null): string {
  if (!d) return "";
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

export function GET(req: NextRequest, ctx: RouteContext) {
  return withAdminAuth(async (req, { adminId, params }) => {
    const examId = params?.id;
    if (!examId) return NextResponse.json({ error: "Missing exam id" }, { status: 400 });

    const exam = await prisma.examForm.findFirst({
      where: { id: examId, adminId },
      select: { title: true, passingScorePercent: true, totalMarks: true },
    });
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    // Fetch all sessions — no pagination for export
    const sessions = await prisma.examSession.findMany({
      where: { examFormId: examId },
      orderBy: { startedAt: "asc" },
      include: {
        student: { select: { id: true, email: true, name: true } },
      },
    });

    // Fetch enrollments for mobile / WhatsApp numbers
    const enrollments = await prisma.examEnrollment.findMany({
      where: { examFormId: examId },
      select: { studentId: true, mobileNumber: true, whatsappNumber: true },
    });
    const enrollmentMap = new Map(enrollments.map((e) => [e.studentId, e]));

    // ── Build worksheet rows ────────────────────────────────────────────────────
    const headers = [
      "S.No.",
      "Student Name",
      "Email",
      "Mobile Number",
      "WhatsApp Number",
      "Status",
      "Result",
      "Score",
      "Total Marks",
      "Percentage (%)",
      `Passing Score (${exam.passingScorePercent}%)`,
      "Time Taken",
      "Tab Switches",
      "Fullscreen Exits",
      "Security",
      "Started At",
      "Submitted At",
    ];

    const rows = sessions.map((s, i) => {
      const enr = enrollmentMap.get(s.student.id);
      const pct = s.percentage !== null ? Number(s.percentage).toFixed(1) : "";
      const status =
        s.status === "submitted" ? "Submitted"
        : s.status === "auto_submitted" ? "Auto-submitted"
        : s.status === "in_progress" ? "In Progress"
        : s.status;
      const result =
        s.isPassed === true ? "Passed"
        : s.isPassed === false ? "Failed"
        : "";
      const security =
        s.tabSwitchCount === 0 && s.fullscreenExitCount === 0 ? "Clean" : "Flagged";

      return [
        i + 1,
        s.student.name ?? "",
        s.student.email,
        enr?.mobileNumber ?? "",
        enr?.whatsappNumber ?? "",
        status,
        result,
        s.score !== null ? Number(s.score) : "",
        s.totalMarks !== null ? Number(s.totalMarks) : "",
        pct,
        Number(exam.passingScorePercent),
        fmtTime(s.timeTakenSeconds),
        s.tabSwitchCount,
        s.fullscreenExitCount,
        security,
        fmtDate(s.startedAt),
        fmtDate(s.submittedAt),
      ];
    });

    // ── Build workbook ─────────────────────────────────────────────────────────
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // Column widths
    ws["!cols"] = [
      { wch: 6  }, // S.No.
      { wch: 22 }, // Name
      { wch: 28 }, // Email
      { wch: 16 }, // Mobile
      { wch: 16 }, // WhatsApp
      { wch: 14 }, // Status
      { wch: 10 }, // Result
      { wch: 8  }, // Score
      { wch: 12 }, // Total Marks
      { wch: 14 }, // Percentage
      { wch: 18 }, // Passing Score
      { wch: 12 }, // Time Taken
      { wch: 13 }, // Tab Switches
      { wch: 16 }, // Fullscreen Exits
      { wch: 10 }, // Security
      { wch: 22 }, // Started At
      { wch: 22 }, // Submitted At
    ];

    // Freeze the header row
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };

    XLSX.utils.book_append_sheet(wb, ws, "Submissions");

    // ── Summary sheet ──────────────────────────────────────────────────────────
    const submitted = sessions.filter((s) => s.status === "submitted" || s.status === "auto_submitted");
    const passed = submitted.filter((s) => s.isPassed === true).length;
    const failed = submitted.filter((s) => s.isPassed === false).length;
    const avgPct =
      submitted.length > 0
        ? (submitted.reduce((sum, s) => sum + Number(s.percentage ?? 0), 0) / submitted.length).toFixed(1)
        : "0.0";
    const avgTimeSec =
      submitted.length > 0
        ? Math.round(submitted.reduce((sum, s) => sum + (s.timeTakenSeconds ?? 0), 0) / submitted.length)
        : null;
    const flagged = sessions.filter((s) => s.tabSwitchCount > 0 || s.fullscreenExitCount > 0).length;

    const summaryData = [
      ["Exam Summary", ""],
      ["", ""],
      ["Exam Title",          exam.title],
      ["Total Marks",         Number(exam.totalMarks)],
      ["Passing Score",       `${exam.passingScorePercent}%`],
      ["", ""],
      ["Total Sessions",      sessions.length],
      ["Submitted",           submitted.length],
      ["In Progress",         sessions.filter((s) => s.status === "in_progress").length],
      ["", ""],
      ["Passed",              passed],
      ["Failed",              failed],
      ["Pass Rate",           submitted.length > 0 ? `${((passed / submitted.length) * 100).toFixed(1)}%` : "—"],
      ["", ""],
      ["Average Score",       `${avgPct}%`],
      ["Average Time Taken",  fmtTime(avgTimeSec)],
      ["Flagged Sessions",    flagged],
      ["", ""],
      ["Export Generated At", fmtDate(new Date())],
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary["!cols"] = [{ wch: 24 }, { wch: 28 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

    // ── Write to buffer ────────────────────────────────────────────────────────
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const safeTitle = exam.title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const filename = `${safeTitle}_submissions_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  })(req, ctx);
}
