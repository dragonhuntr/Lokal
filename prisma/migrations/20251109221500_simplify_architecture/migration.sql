-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('ROUTE', 'JOURNEY');

-- CreateTable
CREATE TABLE "SavedItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nickname" TEXT,
    "type" "ItemType" NOT NULL DEFAULT 'JOURNEY',
    "routeId" TEXT,
    "itineraryData" JSONB,
    "originLat" DOUBLE PRECISION,
    "originLng" DOUBLE PRECISION,
    "totalDistance" INTEGER,
    "totalDuration" INTEGER,
    "lastViewed" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedItem_pkey" PRIMARY KEY ("id")
);

-- Migrate data from SavedJourney to SavedItem
INSERT INTO "SavedItem" (
    "id",
    "userId",
    "nickname",
    "type",
    "itineraryData",
    "originLat",
    "originLng",
    "totalDistance",
    "totalDuration",
    "createdAt"
)
SELECT
    "id",
    "userId",
    "nickname",
    'JOURNEY'::"ItemType",
    "itineraryData",
    "originLat",
    "originLng",
    "totalDistance",
    "totalDuration",
    "createdAt"
FROM "SavedJourney";

-- Migrate data from SavedRoute to SavedItem
INSERT INTO "SavedItem" (
    "id",
    "userId",
    "nickname",
    "type",
    "routeId",
    "createdAt"
)
SELECT
    "id",
    "userId",
    "nickname",
    'ROUTE'::"ItemType",
    "routeId",
    "createdAt"
FROM "SavedRoute";

-- DropForeignKey
ALTER TABLE "Alert" DROP CONSTRAINT "Alert_tripId_fkey";
ALTER TABLE "Alert" DROP CONSTRAINT "Alert_userId_fkey";
ALTER TABLE "Feedback" DROP CONSTRAINT "Feedback_routeId_fkey";
ALTER TABLE "Feedback" DROP CONSTRAINT "Feedback_stopId_fkey";
ALTER TABLE "Feedback" DROP CONSTRAINT "Feedback_userId_fkey";
ALTER TABLE "SavedJourney" DROP CONSTRAINT "SavedJourney_userId_fkey";
ALTER TABLE "SavedRoute" DROP CONSTRAINT "SavedRoute_routeId_fkey";
ALTER TABLE "SavedRoute" DROP CONSTRAINT "SavedRoute_userId_fkey";
ALTER TABLE "Stop" DROP CONSTRAINT "Stop_routeId_fkey";
ALTER TABLE "Trip" DROP CONSTRAINT "Trip_endStopId_fkey";
ALTER TABLE "Trip" DROP CONSTRAINT "Trip_routeId_fkey";
ALTER TABLE "Trip" DROP CONSTRAINT "Trip_startStopId_fkey";
ALTER TABLE "Trip" DROP CONSTRAINT "Trip_userId_fkey";

-- DropTable
DROP TABLE "Alert";
DROP TABLE "Feedback";
DROP TABLE "SavedJourney";
DROP TABLE "SavedRoute";
DROP TABLE "Trip";

-- DropEnum
DROP TYPE "AlertType";
DROP TYPE "TripStatus";

-- AddForeignKey
ALTER TABLE "SavedItem" ADD CONSTRAINT "SavedItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
