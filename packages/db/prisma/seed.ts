import { PrismaClient } from "@prisma/client";
import { seedCourse } from "./seed-data/course";

const prisma = new PrismaClient();

async function main() {
  const course = await prisma.course.upsert({
    where: { slug: seedCourse.slug },
    update: {
      title: seedCourse.title,
      description: seedCourse.description,
      priceKopecks: seedCourse.priceKopecks,
      currency: seedCourse.currency,
      isPublished: seedCourse.isPublished
    },
    create: {
      slug: seedCourse.slug,
      title: seedCourse.title,
      description: seedCourse.description,
      priceKopecks: seedCourse.priceKopecks,
      currency: seedCourse.currency,
      isPublished: seedCourse.isPublished
    }
  });

  for (const lesson of seedCourse.lessons) {
    await prisma.lesson.upsert({
      where: {
        courseId_slug: {
          courseId: course.id,
          slug: lesson.slug
        }
      },
      update: lesson,
      create: {
        ...lesson,
        courseId: course.id
      }
    });
  }

  // Do not overwrite enabled or channel binding: both are deliberate deployment actions.
  await prisma.channelProduct.upsert({
    where: { slug: "creative-ideas" },
    update: {
      title: "Креатив идеи",
      priceKopecks: 39_000,
      currency: "RUB",
      periodDays: 30,
      renewalLeadMinutes: 240,
      gracePeriodMinutes: 1_440
    },
    create: {
      slug: "creative-ideas",
      title: "Креатив идеи",
      priceKopecks: 39_000,
      currency: "RUB",
      periodDays: 30,
      renewalLeadMinutes: 240,
      gracePeriodMinutes: 1_440,
      enabled: false
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
