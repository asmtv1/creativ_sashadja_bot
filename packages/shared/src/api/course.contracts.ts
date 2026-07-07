import { z } from "zod";

export const CourseDtoSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  priceKopecks: z.number().int().nonnegative(),
  currency: z.string().default("RUB").optional()
});

export const LessonPreviewDtoSchema = z.object({
  slug: z.string().min(1),
  sortOrder: z.number().int().nonnegative(),
  title: z.string().min(1),
  description: z.string().nullable(),
  durationSeconds: z.number().int().positive().nullable(),
  posterUrl: z.string().nullable()
});

export const LessonDtoSchema = LessonPreviewDtoSchema.extend({
  kinescopeEmbedUrl: z.string().url()
});

export const CourseAccessResponseSchema = z.object({
  hasAccess: z.boolean(),
  course: CourseDtoSchema,
  lessons: z.array(LessonDtoSchema).optional()
});

export type CourseDto = z.infer<typeof CourseDtoSchema>;
export type LessonPreviewDto = z.infer<typeof LessonPreviewDtoSchema>;
export type LessonDto = z.infer<typeof LessonDtoSchema>;
export type CourseAccessResponse = z.infer<typeof CourseAccessResponseSchema>;
