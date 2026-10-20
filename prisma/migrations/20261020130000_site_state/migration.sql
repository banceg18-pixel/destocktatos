-- Versions partagées des caches (contenus WordPress, catalogue) entre les copies du site.
CREATE TABLE "SiteState" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
