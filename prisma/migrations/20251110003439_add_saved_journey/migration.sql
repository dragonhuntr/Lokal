-- CreateTable
CREATE TABLE "SavedJourney" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nickname" TEXT,
    "itineraryData" JSONB NOT NULL,
    "originLat" DOUBLE PRECISION NOT NULL,
    "originLng" DOUBLE PRECISION NOT NULL,
    "totalDistance" INTEGER NOT NULL,
    "totalDuration" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedJourney_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SavedJourney" ADD CONSTRAINT "SavedJourney_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
