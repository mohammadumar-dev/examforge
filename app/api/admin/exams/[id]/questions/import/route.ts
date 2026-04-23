import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdminAuth } from "@/lib/withAdminAuth";
import { invalidateExamCaches } from "@/lib/examCacheInvalidation";
import * as XLSX from "xlsx";

type RouteContext = { params: Promise<{ id: string }> };

const CORRECT_ANSWER_MAP: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };

interface ParsedRow {
  questionText: string;
  options: string[];
  correctIndex: number;
  sectionName: string;
  rowNumber: number;
}

/** Normalize a header key: lowercase, collapse spaces, strip punctuation. */
function normalizeKey(k: string) {
  return k.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Find a value in a row by trying several header aliases (all normalized). */
function col(row: Record<string, unknown>, ...aliases: string[]): string {
  const normalized = Object.fromEntries(
    Object.entries(row).map(([k, v]) => [normalizeKey(k), v])
  );
  for (const alias of aliases) {
    const v = normalized[normalizeKey(alias)];
    if (v !== undefined && v !== "") return String(v).trim();
  }
  return "";
}

function parseSheet(buffer: ArrayBuffer, filename: string): { rows: ParsedRow[]; errors: string[]; headers: string[] } {
  const lower = filename.toLowerCase();
  const isCsv = lower.endsWith(".csv");
  const workbook = isCsv
    ? XLSX.read(Buffer.from(buffer).toString("utf8"), { type: "string" })
    : XLSX.read(buffer, { type: "array" }); // handles .xlsx and .xls
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const headers = raw.length > 0 ? Object.keys(raw[0]) : [];
  const rows: ParsedRow[] = [];
  const errors: string[] = [];

  raw.forEach((r, i) => {
    const rowNumber = i + 2;
    const questionText = col(r, "Question", "question text", "q", "questions");
    const optA = col(r, "Option A", "option a", "a", "opt a", "opta");
    const optB = col(r, "Option B", "option b", "b", "opt b", "optb");
    const optC = col(r, "Option C", "option c", "c", "opt c", "optc");
    const optD = col(r, "Option D", "option d", "d", "opt d", "optd");
    // Accept "B) ENERGY", "B) ...", "B.", "B" — extract the leading letter
    const correctFull = col(r, "Correct Answer", "correct", "answer", "correct option", "ans").toUpperCase();
    const correctRaw = correctFull.match(/^([A-D])/)?.[1] ?? "";
    const sectionName = col(r, "Section", "section name", "subject");

    if (!questionText) {
      errors.push(`Row ${rowNumber}: Question text is empty`);
      return;
    }
    if (!optA || !optB || !optC || !optD) {
      errors.push(`Row ${rowNumber}: All four options (A–D) are required`);
      return;
    }
    if (!(correctRaw in CORRECT_ANSWER_MAP)) {
      errors.push(`Row ${rowNumber}: Correct Answer must be A, B, C, or D (got "${correctRaw}")`);
      return;
    }

    rows.push({
      questionText,
      options: [optA, optB, optC, optD],
      correctIndex: CORRECT_ANSWER_MAP[correctRaw],
      sectionName,
      rowNumber,
    });
  });

  return { rows, errors, headers };
}

export function POST(req: NextRequest, ctx: RouteContext) {
  return withAdminAuth(async (req, { adminId, params }) => {
    const examId = params?.id;
    if (!examId) return NextResponse.json({ error: "Missing exam id" }, { status: 400 });

    const exam = await prisma.examForm.findFirst({ where: { id: examId, adminId } });
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    const formData = await req.formData().catch(() => null);
    if (!formData) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });

    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const sectionIdRaw = formData.get("sectionId");
    const sectionId = typeof sectionIdRaw === "string" && sectionIdRaw ? sectionIdRaw : null;

    // Validate sectionId belongs to this exam if provided
    if (sectionId) {
      const section = await prisma.examSection.findFirst({ where: { id: sectionId, examFormId: examId } });
      if (!section) return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    const filename = typeof file === "object" && "name" in file ? (file as File).name : "file.csv";
    const lower = filename.toLowerCase();
    if (!lower.endsWith(".csv") && !lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload a .csv, .xlsx, or .xls file." },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const { rows, errors, headers } = parseSheet(buffer, filename);

    console.log("[import] detected headers:", headers);
    console.log("[import] parsed rows:", rows.length, "errors:", errors);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No valid questions found", details: errors, detectedHeaders: headers },
        { status: 422 }
      );
    }

    // Resolve section names from rows → section IDs, auto-creating missing sections
    const uniqueSectionNames = [...new Set(rows.map((r) => r.sectionName).filter(Boolean))];
    const sectionNameToId = new Map<string, string>();

    if (uniqueSectionNames.length > 0) {
      const existingSections = await prisma.examSection.findMany({
        where: { examFormId: examId },
        select: { id: true, name: true, orderIndex: true },
      });

      const lastOrderIndex = existingSections.reduce((max, s) => Math.max(max, s.orderIndex), -1);

      for (const s of existingSections) {
        sectionNameToId.set(s.name.toLowerCase(), s.id);
      }

      // Create sections that don't exist yet
      const toCreate = uniqueSectionNames.filter((n) => !sectionNameToId.has(n.toLowerCase()));
      for (let i = 0; i < toCreate.length; i++) {
        const newSection = await prisma.examSection.create({
          data: {
            examFormId: examId,
            name: toCreate[i],
            orderIndex: lastOrderIndex + 1 + i,
          },
        });
        sectionNameToId.set(toCreate[i].toLowerCase(), newSection.id);
      }
    }

    // Get starting orderIndex
    const lastQuestion = await prisma.examQuestion.findFirst({
      where: { examFormId: examId },
      orderBy: { orderIndex: "desc" },
      select: { orderIndex: true },
    });
    const baseIndex = (lastQuestion?.orderIndex ?? -1) + 1;

    // Resolve each row's sectionId: row Section column → fallback to form sectionId
    const resolvedSectionIds = rows.map((row) => {
      if (row.sectionName) return sectionNameToId.get(row.sectionName.toLowerCase()) ?? sectionId;
      return sectionId;
    });

    const created = await prisma.$transaction(
      rows.map((row, i) =>
        prisma.examQuestion.create({
          data: {
            examFormId: examId,
            questionText: row.questionText,
            questionType: "single_choice",
            marks: 1,
            orderIndex: baseIndex + i,
            sectionId: resolvedSectionIds[i] ?? null,
            options: {
              create: row.options.map((text, oi) => ({
                optionText: text,
                isCorrect: oi === row.correctIndex,
                orderIndex: oi,
              })),
            },
          },
          include: { options: { orderBy: { orderIndex: "asc" } } },
        })
      )
    );

    // Recalculate total marks
    const allQuestions = await prisma.examQuestion.findMany({
      where: { examFormId: examId },
      select: { marks: true },
    });
    const totalMarks = allQuestions.reduce((sum, q) => sum + Number(q.marks), 0);
    await prisma.examForm.update({ where: { id: examId }, data: { totalMarks } });
    await invalidateExamCaches(examId);

    return NextResponse.json(
      {
        imported: created.length,
        skipped: errors.length,
        errors: errors.length > 0 ? errors : undefined,
        questions: created,
      },
      { status: 201 }
    );
  })(req, ctx);
}
