/*
  Warnings:

  - You are about to drop the `SavedJourney` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."SavedJourney" DROP CONSTRAINT "SavedJourney_userId_fkey";

-- DropTable
DROP TABLE "public"."SavedJourney";

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceDate" (
    "id" TEXT NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "exceptionType" INTEGER NOT NULL,

    CONSTRAINT "ServiceDate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "gtfsTripId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "directionId" INTEGER NOT NULL,
    "headsign" TEXT NOT NULL,
    "shapeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StopTime" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "stopId" TEXT NOT NULL,
    "arrivalTime" TEXT NOT NULL,
    "departureTime" TEXT NOT NULL,
    "stopSequence" INTEGER NOT NULL,
    "isTimepoint" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "StopTime_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Service_serviceId_key" ON "Service"("serviceId");

-- CreateIndex
CREATE INDEX "Service_serviceId_idx" ON "Service"("serviceId");

-- CreateIndex
CREATE INDEX "ServiceDate_serviceId_date_idx" ON "ServiceDate"("serviceId", "date");

-- CreateIndex
CREATE INDEX "ServiceDate_date_idx" ON "ServiceDate"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceDate_serviceId_date_key" ON "ServiceDate"("serviceId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Trip_gtfsTripId_key" ON "Trip"("gtfsTripId");

-- CreateIndex
CREATE INDEX "Trip_routeId_idx" ON "Trip"("routeId");

-- CreateIndex
CREATE INDEX "Trip_serviceId_idx" ON "Trip"("serviceId");

-- CreateIndex
CREATE INDEX "Trip_gtfsTripId_idx" ON "Trip"("gtfsTripId");

-- CreateIndex
CREATE INDEX "StopTime_tripId_stopSequence_idx" ON "StopTime"("tripId", "stopSequence");

-- CreateIndex
CREATE INDEX "StopTime_stopId_idx" ON "StopTime"("stopId");

-- CreateIndex
CREATE INDEX "StopTime_stopId_departureTime_idx" ON "StopTime"("stopId", "departureTime");

-- CreateIndex
CREATE INDEX "SavedItem_userId_idx" ON "SavedItem"("userId");

-- CreateIndex
CREATE INDEX "SavedItem_userId_type_idx" ON "SavedItem"("userId", "type");

-- CreateIndex
CREATE INDEX "Stop_routeId_idx" ON "Stop"("routeId");

-- AddForeignKey
ALTER TABLE "Stop" ADD CONSTRAINT "Stop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceDate" ADD CONSTRAINT "ServiceDate_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("serviceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("serviceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StopTime" ADD CONSTRAINT "StopTime_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StopTime" ADD CONSTRAINT "StopTime_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "Stop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
