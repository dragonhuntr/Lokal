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

-- Migrate data from SavedJourney to SavedItem (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'SavedJourney') THEN
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
    END IF;
END $$;

-- Migrate data from SavedRoute to SavedItem (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'SavedRoute') THEN
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
    END IF;
END $$;

-- DropForeignKey
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'Alert') THEN
        ALTER TABLE "Alert" DROP CONSTRAINT IF EXISTS "Alert_tripId_fkey";
        ALTER TABLE "Alert" DROP CONSTRAINT IF EXISTS "Alert_userId_fkey";
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'Feedback') THEN
        ALTER TABLE "Feedback" DROP CONSTRAINT IF EXISTS "Feedback_routeId_fkey";
        ALTER TABLE "Feedback" DROP CONSTRAINT IF EXISTS "Feedback_stopId_fkey";
        ALTER TABLE "Feedback" DROP CONSTRAINT IF EXISTS "Feedback_userId_fkey";
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'SavedJourney') THEN
        ALTER TABLE "SavedJourney" DROP CONSTRAINT IF EXISTS "SavedJourney_userId_fkey";
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'SavedRoute') THEN
        ALTER TABLE "SavedRoute" DROP CONSTRAINT IF EXISTS "SavedRoute_routeId_fkey";
        ALTER TABLE "SavedRoute" DROP CONSTRAINT IF EXISTS "SavedRoute_userId_fkey";
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'Stop') THEN
        ALTER TABLE "Stop" DROP CONSTRAINT IF EXISTS "Stop_routeId_fkey";
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'Trip') THEN
        ALTER TABLE "Trip" DROP CONSTRAINT IF EXISTS "Trip_endStopId_fkey";
        ALTER TABLE "Trip" DROP CONSTRAINT IF EXISTS "Trip_routeId_fkey";
        ALTER TABLE "Trip" DROP CONSTRAINT IF EXISTS "Trip_startStopId_fkey";
        ALTER TABLE "Trip" DROP CONSTRAINT IF EXISTS "Trip_userId_fkey";
    END IF;
END $$;

-- DropTable
DO $$
BEGIN
    DROP TABLE IF EXISTS "Alert";
    DROP TABLE IF EXISTS "Feedback";
    DROP TABLE IF EXISTS "SavedJourney";
    DROP TABLE IF EXISTS "SavedRoute";
    DROP TABLE IF EXISTS "Trip";
END $$;

-- DropEnum
DO $$
BEGIN
    DROP TYPE IF EXISTS "AlertType";
    DROP TYPE IF EXISTS "TripStatus";
END $$;

-- AddForeignKey
ALTER TABLE "SavedItem" ADD CONSTRAINT "SavedItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
