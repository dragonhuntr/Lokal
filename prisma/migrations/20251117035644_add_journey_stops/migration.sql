-- AlterTable
ALTER TABLE "SavedItem" ADD COLUMN     "departureTime" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "JourneyStop" (
    "id" TEXT NOT NULL,
    "savedItemId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 0,
    "purpose" TEXT,
    "arrivalTime" TIMESTAMP(3),
    "departureTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JourneyStop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JourneyStop_savedItemId_sequence_idx" ON "JourneyStop"("savedItemId", "sequence");

-- CreateIndex
CREATE INDEX "JourneyStop_savedItemId_idx" ON "JourneyStop"("savedItemId");

-- AddForeignKey
ALTER TABLE "JourneyStop" ADD CONSTRAINT "JourneyStop_savedItemId_fkey" FOREIGN KEY ("savedItemId") REFERENCES "SavedItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
