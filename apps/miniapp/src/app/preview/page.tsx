import { notFound } from "next/navigation";
import { CourseLessons } from "../../components/CourseLessons";

export default function CoursePreviewPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return (
    <CourseLessons
      course={{
        slug: "preview-course",
        title: "Креативный контент | обучение",
        description: "Локальный предпросмотр дизайна",
        priceKopecks: 59900
      }}
      lessons={[
        {
          slug: "content-start",
          sortOrder: 1,
          title: "С чего начинается креатив",
          description: "Разбираем основу и настраиваемся на практику.",
          durationSeconds: 600,
          kinescopeEmbedUrl: "https://kinescope.io/embed/secret",
          posterUrl: null
        }
      ]}
    />
  );
}
