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

type WatermarkViewer = {
  telegramId: string;
  username: string | null;
};

export function buildKinescopeWatermark(viewer: WatermarkViewer): string {
  return viewer.username
    ? `Telegram: @${viewer.username} · ID: ${viewer.telegramId}`
    : `Telegram ID: ${viewer.telegramId}`;
}

export function withKinescopeWatermark(embedUrl: string, viewer: WatermarkViewer): string {
  const url = new URL(embedUrl);
  url.searchParams.set("watermark", buildKinescopeWatermark(viewer));
  return url.toString();
}

export function buildCourseAccessResponse(input: {
  hasAccess: boolean;
  course: CourseLike;
  lessons: LessonLike[];
  viewer?: WatermarkViewer;
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
      kinescopeEmbedUrl: input.viewer
        ? withKinescopeWatermark(lesson.kinescopeEmbedUrl, input.viewer)
        : lesson.kinescopeEmbedUrl,
      posterUrl: lesson.posterUrl
    }))
  };
}
