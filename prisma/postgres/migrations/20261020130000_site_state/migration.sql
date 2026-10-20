-- Versions partagées des caches (contenus WordPress, catalogue) entre les copies du site.
CREATE TABLE "SiteState" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteState_pkey" PRIMARY KEY ("key")
);
