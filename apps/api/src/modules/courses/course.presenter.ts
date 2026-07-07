import { CourseAccessResponse } from "@course/shared";

type CourseLike = {
  slug: string;
  title: string;
  description: string;
  priceKopecks: number;
  currency?: string | null;
};

type LessonLike = {
  slug: string;
  sortOrder: number;
  title: string;
  description: string | null;
  durationSeconds: number | null;
  kinescopeEmbedUrl: string;
  posterUrl: string | null;
};

export function buildCourseAccessResponse(input: {
  hasAccess: boolean;
  course: CourseLike;
  lessons: LessonLike[];
}): CourseAccessResponse {
  const course = {
    slug: input.course.slug,
    title: input.course.title,
    description: input.course.description,
    priceKopecks: input.course.priceKopecks,
    currency: input.course.currency ?? "RUB"
  };

  if (!input.hasAccess) {
    return { hasAccess: false, course };
  }

  return {
    hasAccess: true,
    course,
    lessons: input.lessons.map((lesson) => ({
      slug: lesson.slug,
      sortOrder: lesson.sortOrder,
      title: lesson.title,
      description: lesson.description,
      durationSeconds: lesson.durationSeconds,
      kinescopeEmbedUrl: lesson.kinescopeEmbedUrl,
      posterUrl: lesson.posterUrl
    }))
  };
}
