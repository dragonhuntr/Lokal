"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function SharedJourneyPage() {
  const params = useParams();
  const router = useRouter();
  const journeyId = params.id as string;

  useEffect(() => {
    if (journeyId) {
      // Redirect to map with journeyId query parameter
      router.replace(`/?journeyId=${encodeURIComponent(journeyId)}`);
    }
  }, [journeyId, router]);

  // Show loading state while redirecting
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-lg text-muted-foreground">Loading journey…</div>
    </div>
  );
}
