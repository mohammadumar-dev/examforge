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

export const updateExamDetailsSchema = z
  .object({
    title: z.string().min(3).max(255),
    description: z.string().nullable(),
    instructions: z.string().nullable(),
    scheduledStartAt: z.string().datetime({ local: true }).nullable(),
    scheduledEndAt: z.string().datetime({ local: true }).nullable(),
    timeLimitMinutes: z.number().int().positive().nullable(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  })
  .refine(
    (data) => {
      if (data.scheduledStartAt && data.scheduledEndAt) {
        return new Date(data.scheduledEndAt) > new Date(data.scheduledStartAt);
      }
      return true;
    },
    { message: "scheduledEndAt must be after scheduledStartAt", path: ["scheduledEndAt"] }
  );

export const createQuestionSchema = z.object({
  questionText: z.string().min(1),
  questionType: z.enum(["single_choice", "multiple_choice"]).default("single_choice"),
  marks: z.number().positive().default(1),
  explanation: z.string().optional(),
  isRequired: z.boolean().default(true),
  sectionId: z.string().uuid().optional().nullable(),
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

export const createSectionSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});

export const updateSectionSchema = createSectionSchema.partial();

export const reorderSectionsSchema = z.object({
  sectionIds: z.array(z.string().uuid()),
});
