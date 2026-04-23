import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import PDFDocument from "pdfkit";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ slug: string; sessionId: string }> };

// ─── Colour palette ────────────────────────────────────────────────────────────
const C = {
  indigo:      [63,  98, 232] as [number, number, number],
  indigoDark:  [39,  62, 175] as [number, number, number],
  indigoLight: [224, 231, 255] as [number, number, number],
  green:       [22, 163,  74] as [number, number, number],
  greenLight:  [220, 252, 231] as [number, number, number],
  red:         [220,  38,  38] as [number, number, number],
  redLight:    [254, 226, 226] as [number, number, number],
  dark:        [17,  24,  39] as [number, number, number],
  muted:       [107, 114, 128] as [number, number, number],
  border:      [229, 231, 235] as [number, number, number],
  bg:          [249, 250, 251] as [number, number, number],
  white:       [255, 255, 255] as [number, number, number],
};

function bufferPdf(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

function fmtTime(seconds: number | null): string {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { slug, sessionId } = await ctx.params;
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Result token required" }, { status: 401 });
  }

  const session = await prisma.examSession.findFirst({
    where: { id: sessionId, resultShareToken: token, examForm: { slug } },
    include: {
      student: { select: { name: true, email: true } },
      examForm: { select: { title: true, passingScorePercent: true } },
    },
  });

  if (!session) return NextResponse.json({ error: "Result not found" }, { status: 404 });
  if (session.status === "in_progress")
    return NextResponse.json({ error: "Exam not yet submitted" }, { status: 400 });

  // Fetch per-section breakdown
  const sectionResponses = await prisma.examResponse.findMany({
    where: { sessionId },
    select: {
      isCorrect: true,
      isSkipped: true,
      marksAwarded: true,
      question: {
        select: {
          marks: true,
          section: { select: { id: true, name: true, orderIndex: true } },
        },
      },
    },
  });

  interface SectionStat {
    name: string;
    orderIndex: number;
    score: number;
    totalMarks: number;
    correct: number;
    total: number;
    skipped: number;
  }
  const hasSections = sectionResponses.some((r) => r.question.section !== null);
  const sectionStats: SectionStat[] = [];

  if (hasSections) {
    const map = new Map<string, SectionStat>();
    for (const r of sectionResponses) {
      const sec = r.question.section;
      const key = sec?.id ?? "__none__";
      if (!map.has(key)) {
        map.set(key, {
          name: sec?.name ?? "General",
          orderIndex: sec?.orderIndex ?? 9999,
          score: 0,
          totalMarks: 0,
          correct: 0,
          total: 0,
          skipped: 0,
        });
      }
      const entry = map.get(key)!;
      entry.total += 1;
      entry.totalMarks += Number(r.question.marks);
      if (r.isSkipped) {
        entry.skipped += 1;
      } else if (r.isCorrect) {
        entry.correct += 1;
        entry.score += Number(r.marksAwarded ?? 0);
      }
    }
    sectionStats.push(...[...map.values()].sort((a, b) => a.orderIndex - b.orderIndex));
  }

  const passed      = !!session.isPassed;
  const pct         = Number(session.percentage ?? 0);
  const score       = Number(session.score ?? 0);
  const totalMarks  = Number(session.totalMarks ?? 0);
  const passingPct  = Number(session.examForm.passingScorePercent ?? 0);
  const studentName = session.student.name ?? session.student.email;
  const submittedAt = session.submittedAt
    ? session.submittedAt.toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" })
    : "—";

  // ─── Build PDF ──────────────────────────────────────────────────────────────
  const doc = new PDFDocument({ size: "A4", margin: 0, info: {
    Title: `${session.examForm.title} — Result`,
    Author: "HI Tech Examination",
  }});

  const W = 595; // A4 width in points
  const margin = 48;
  const contentW = W - margin * 2;

  // ── 1. Header banner ────────────────────────────────────────────────────────
  doc.rect(0, 0, W, 130).fill(C.indigo);

  // App name (top-left)
  doc.fontSize(11).fillColor(C.indigoLight).font("Helvetica")
     .text("HI TECH EXAMINATION", margin, 28, { characterSpacing: 2 });

  // "Result Certificate" badge (top-right)
  const badgeText = "Result Certificate";
  const badgeW = 130, badgeH = 22;
  doc.roundedRect(W - margin - badgeW, 24, badgeW, badgeH, 11)
     .fillAndStroke([255,255,255,0.15] as unknown as string, C.indigoDark);
  doc.fontSize(9).fillColor(C.white).font("Helvetica")
     .text(badgeText, W - margin - badgeW, 31, { width: badgeW, align: "center" });

  // Exam title
  doc.fontSize(22).fillColor(C.white).font("Helvetica-Bold")
     .text(session.examForm.title, margin, 56, { width: contentW });

  // Divider line inside header
  doc.moveTo(margin, 108).lineTo(W - margin, 108)
     .strokeColor([255,255,255,0.25] as unknown as string).lineWidth(1).stroke();

  // Submitted label
  doc.fontSize(9).fillColor(C.indigoLight).font("Helvetica")
     .text(`Submitted: ${submittedAt}`, margin, 114, { width: contentW });

  // ── 2. Student info card ─────────────────────────────────────────────────────
  const cardTop = 150;
  doc.roundedRect(margin, cardTop, contentW, 64, 8)
     .fill(C.bg);
  doc.roundedRect(margin, cardTop, contentW, 64, 8)
     .stroke(C.border);

  doc.fontSize(9).fillColor(C.muted).font("Helvetica")
     .text("STUDENT", margin + 18, cardTop + 14);
  doc.fontSize(14).fillColor(C.dark).font("Helvetica-Bold")
     .text(studentName, margin + 18, cardTop + 26);
  doc.fontSize(10).fillColor(C.muted).font("Helvetica")
     .text(session.student.email, margin + 18, cardTop + 44);

  // Session ID on the right
  const sidLabel = `Session ID: ${sessionId.slice(0, 8).toUpperCase()}`;
  doc.fontSize(8).fillColor(C.muted).font("Helvetica")
     .text(sidLabel, margin, cardTop + 14, { width: contentW - 18, align: "right" });

  // ── 3. Result hero card ──────────────────────────────────────────────────────
  const heroTop = cardTop + 84;
  const heroH = 148;
  const resultColor = passed ? C.green : C.red;
  const resultBg    = passed ? C.greenLight : C.redLight;

  doc.roundedRect(margin, heroTop, contentW, heroH, 10).fill(resultBg);
  doc.roundedRect(margin, heroTop, contentW, heroH, 10).stroke(resultColor);

  // Pass / Fail pill badge
  const pillW = 90, pillH = 26;
  const pillX = margin + (contentW - pillW) / 2;
  doc.roundedRect(pillX, heroTop + 18, pillW, pillH, 13).fill(resultColor);
  doc.fontSize(11).fillColor(C.white).font("Helvetica-Bold")
     .text(passed ? "✓  PASSED" : "✗  FAILED", pillX, heroTop + 25, {
       width: pillW, align: "center",
     });

  // Score fraction
  doc.fontSize(44).fillColor(C.dark).font("Helvetica-Bold")
     .text(`${score}`, margin, heroTop + 58, { width: contentW, align: "center" });

  // " / totalMarks" in muted smaller text — positioned after the score
  // Using a trick: measure score width and draw muted suffix inline
  const scoreStr   = `${score}`;
  const scoreW     = doc.widthOfString(scoreStr);
  const centerX    = margin + contentW / 2;
  const scoreStartX = centerX - scoreW / 2;
  doc.fontSize(20).fillColor(C.muted).font("Helvetica")
     .text(`/ ${totalMarks}`, scoreStartX + scoreW + 6, heroTop + 72);

  // Percentage
  doc.fontSize(15).fillColor(resultColor).font("Helvetica-Bold")
     .text(`${pct.toFixed(1)}%`, margin, heroTop + 112, { width: contentW, align: "center" });

  // ── 4. Details table ─────────────────────────────────────────────────────────
  const tableTop = heroTop + heroH + 24;
  const rowH = 36;
  const rows = [
    ["Passing Score Required", `${passingPct.toFixed(0)}%`],
    ["Your Score",             `${pct.toFixed(1)}%`],
    ["Marks Obtained",         `${score} out of ${totalMarks}`],
    ["Time Taken",             fmtTime(session.timeTakenSeconds)],
    ["Exam Status",            passed ? "Passed ✓" : "Failed ✗"],
  ];

  // Table header row
  doc.rect(margin, tableTop, contentW, rowH).fill(C.indigo);
  doc.fontSize(10).fillColor(C.white).font("Helvetica-Bold")
     .text("Performance Summary", margin + 16, tableTop + 12, { width: contentW * 0.55 });
  doc.fontSize(10).fillColor(C.indigoLight).font("Helvetica")
     .text("Details", margin + 16 + contentW * 0.55, tableTop + 12, {
       width: contentW * 0.4, align: "right",
     });

  // Rows
  rows.forEach(([label, value], i) => {
    const y = tableTop + rowH + i * rowH;
    const bg = i % 2 === 0 ? C.white : C.bg;
    doc.rect(margin, y, contentW, rowH).fill(bg);
    doc.rect(margin, y, contentW, rowH).stroke(C.border);

    // Left col
    doc.fontSize(10).fillColor(C.muted).font("Helvetica")
       .text(label, margin + 16, y + 13, { width: contentW * 0.55 });

    // Right col — colour result status
    const valueColor =
      label === "Exam Status"
        ? resultColor
        : C.dark;
    doc.fontSize(10).fillColor(valueColor).font("Helvetica-Bold")
       .text(value, margin + 16, y + 13, {
         width: contentW - 32, align: "right",
       });
  });

  // ── 5. Section-wise breakdown table (only when exam has sections) ────────────
  let sectionTableBottom = tableTop + rowH * (rows.length + 1);

  if (sectionStats.length > 0) {
    const secTableTop = sectionTableBottom + 32;
    const secRowH = 32;
    const col1W = contentW * 0.4;
    const col2W = contentW * 0.2;
    const col3W = contentW * 0.2;
    const col4W = contentW - col1W - col2W - col3W;

    // Section table header
    doc.rect(margin, secTableTop, contentW, secRowH).fill(C.indigoDark);
    doc.fontSize(10).fillColor(C.white).font("Helvetica-Bold")
       .text("Section-wise Breakdown", margin + 16, secTableTop + 10, { width: col1W });
    doc.fontSize(9).fillColor(C.indigoLight).font("Helvetica")
       .text("Score", margin + col1W, secTableTop + 11, { width: col2W, align: "center" });
    doc.fontSize(9).fillColor(C.indigoLight).font("Helvetica")
       .text("Correct", margin + col1W + col2W, secTableTop + 11, { width: col3W, align: "center" });
    doc.fontSize(9).fillColor(C.indigoLight).font("Helvetica")
       .text("%", margin + col1W + col2W + col3W, secTableTop + 11, { width: col4W, align: "center" });

    sectionStats.forEach((s, i) => {
      const y = secTableTop + secRowH + i * secRowH;
      const bg = i % 2 === 0 ? C.white : C.bg;
      const pct = s.totalMarks > 0 ? ((s.score / s.totalMarks) * 100).toFixed(1) : "0.0";

      doc.rect(margin, y, contentW, secRowH).fill(bg);
      doc.rect(margin, y, contentW, secRowH).stroke(C.border);

      doc.fontSize(10).fillColor(C.dark).font("Helvetica-Bold")
         .text(s.name, margin + 16, y + 10, { width: col1W - 16 });
      doc.fontSize(10).fillColor(C.dark).font("Helvetica")
         .text(`${s.score} / ${s.totalMarks}`, margin + col1W, y + 10, { width: col2W, align: "center" });
      doc.fontSize(10).fillColor(C.green).font("Helvetica-Bold")
         .text(`${s.correct} / ${s.total}`, margin + col1W + col2W, y + 10, { width: col3W, align: "center" });
      doc.fontSize(10).fillColor(C.dark).font("Helvetica-Bold")
         .text(`${pct}%`, margin + col1W + col2W + col3W, y + 10, { width: col4W, align: "center" });
    });

    sectionTableBottom = secTableTop + secRowH * (sectionStats.length + 1);
  }

  // ── 6. Footer ────────────────────────────────────────────────────────────────
  const footerTop = sectionTableBottom + 24;

  doc.moveTo(margin, footerTop).lineTo(W - margin, footerTop)
     .strokeColor(C.border).lineWidth(1).stroke();

  doc.fontSize(8).fillColor(C.muted).font("Helvetica")
     .text(
       "This is an automatically generated result document issued by HI Tech Examination.",
       margin, footerTop + 12, { width: contentW, align: "center" }
     );

  const generatedAt = new Date().toLocaleString("en-IN", {
    dateStyle: "long", timeStyle: "short",
  });
  doc.fontSize(8).fillColor(C.muted).font("Helvetica")
     .text(`Generated on ${generatedAt}`, margin, footerTop + 26, {
       width: contentW, align: "center",
     });

  // ─── Stream to buffer ────────────────────────────────────────────────────────
  const pdfBuffer = await bufferPdf(doc);

  const filename = `${slug}-result.pdf`;
  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
