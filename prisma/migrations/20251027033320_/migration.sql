/*
  Warnings:

  - A unique constraint covering the columns `[userId,routeId]` on the table `SavedRoute` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "SavedRoute_userId_routeId_key" ON "SavedRoute"("userId", "routeId");
