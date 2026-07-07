export const seedCourse = {
  slug: "basic-course",
  title: "Креативный контент | обучение",
  description:
    "Если хочешь научиться создавать креативный контент, то запускай бота и смотри уроки!",
  priceKopecks: 59900,
  currency: "RUB",
  isPublished: true,
  lessons: [
    {
      slug: "gamification-content",
      sortOrder: 1,
      title: "Геймификация в контенте",
      description:
        "Урок о том, как работает геймифицированный контент, с разбором кейсов брендов и техникой придумывания своих идей.",
      durationSeconds: 1980,
      kinescopeVideoId: "nAY1GccmG13EoGsGsZAVST",
      kinescopeEmbedUrl: "https://kinescope.io/nAY1GccmG13EoGsGsZAVST/plxSBXua",
      posterUrl: null,
      isPublished: true
    }
  ]
} as const;
