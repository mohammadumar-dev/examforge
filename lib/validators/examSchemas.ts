import { z } from "zod";

export const createExamSchema = z.object({
  title: z.string().min(3).max(255),
  description: z.string().optional(),
  instructions: z.string().optional(),
  timeLimitMinutes: z.number().int().positive().optional().nullable(),
  scheduledStartAt: z.string().datetime({ local: true }).optional().nullable(),
  scheduledEndAt: z.string().datetime({ local: true }).optional().nullable(),
  passingScorePercent: z.number().int().min(0).max(100).default(0),
  shuffleQuestions: z.boolean().default(false),
  shuffleOptions: z.boolean().default(false),
  showResultImmediately: z.boolean().default(true),
  allowReviewAnswers: z.boolean().default(false),
});

export const updateExamSchema = createExamSchema.partial();

export const createQuestionSchema = z.object({
  questionText: z.string().min(1),
  questionType: z.enum(["single_choice", "multiple_choice"]).default("single_choice"),
  marks: z.number().positive().default(1),
  explanation: z.string().optional(),
  isRequired: z.boolean().default(true),
  options: z
    .array(
      z.object({
        optionText: z.string().min(1),
        isCorrect: z.boolean().default(false),
        orderIndex: z.number().int().min(0),
      })
    )
    .min(2, "At least 2 options required")
    .max(6, "Maximum 6 options"),
});

export const updateQuestionSchema = createQuestionSchema.partial();

export const reorderQuestionsSchema = z.object({
  questionIds: z.array(z.string().uuid()),
});
