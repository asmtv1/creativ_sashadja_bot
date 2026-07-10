import { LessonDto } from "@course/shared";

export function LessonPlayer({ lesson }: { lesson: LessonDto }) {
  return (
    <div className="player-wrap">
      <iframe
        className="player"
        title={lesson.title}
        src={lesson.kinescopeEmbedUrl}
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
      />
    </div>
  );
}
