"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, BusFront, Clock, Footprints, MapPin, Share2 } from "lucide-react";
import type { PlanItinerary, PlanLeg } from "@/server/routing/service";

type JourneyResponse = {
  id: string;
  nickname: string | null;
  itineraryData: PlanItinerary;
  totalDistance: number | null;
  totalDuration: number | null;
  createdAt: string;
};

export default function SharedJourneyPage() {
  const params = useParams();
  const router = useRouter();
  const journeyId = params.id as string;
  const [journey, setJourney] = useState<JourneyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareSuccess, setShareSuccess] = useState(false);

  useEffect(() => {
    const fetchJourney = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/journeys/${encodeURIComponent(journeyId)}`);
        if (!response.ok) {
          setError(response.status === 404 ? "Journey not found" : "Failed to load journey");
          setJourney(null);
          return;
        }

        const data = (await response.json()) as { journey: JourneyResponse };
        setJourney(data.journey);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch journey", err);
        setError("Failed to load journey");
      } finally {
        setLoading(false);
      }
    };

    if (journeyId) {
      void fetchJourney();
    }
  }, [journeyId]);

  const destinationName = useMemo(() => {
    if (!journey) return "your destination";
    const legs = journey.itineraryData.legs;
    if (!legs.length) return "your destination";
    const lastLeg = legs[legs.length - 1];
    return lastLeg?.endStopName ?? lastLeg?.end?.stopName ?? "your destination";
  }, [journey]);

  const handleShare = async () => {
    if (!journey) return;
    const shareUrl = window.location.href;
    const message = `View my Journey on Lokal! ETA to ${destinationName} is ${formatShareMinutes(journey.itineraryData.totalDurationMinutes)}. ${shareUrl}`;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2000);
      } else {
        throw new Error("Clipboard API unavailable");
      }
    } catch (err) {
      console.error("Failed to copy journey link", err);
      alert("Unable to copy share link. Please copy it manually: " + shareUrl);
    }
  };

  const handleViewOnMap = () => {
    router.push(`/?journeyId=${journeyId}`);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading journey…</div>
      </div>
    );
  }

  if (error || !journey) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
        <div>
          <h1 className="text-3xl font-bold text-red-600">Journey Unavailable</h1>
          <p className="mt-2 text-muted-foreground">{error ?? "This journey could not be found."}</p>
        </div>
        <button
          onClick={() => router.push("/")}
          className="rounded-md border px-6 py-3 text-sm font-medium hover:bg-muted"
        >
          Back to Map
        </button>
      </div>
    );
  }

  const totalDistanceMeters = journey.totalDistance ?? journey.itineraryData.totalDistanceMeters;
  const totalDurationMinutes = journey.totalDuration ?? journey.itineraryData.totalDurationMinutes;
  const createdDate = new Date(journey.createdAt);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Map
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl p-4">
        <div className="overflow-hidden rounded-lg border bg-card shadow-lg">
          <div className="bg-gradient-to-r from-purple-600 via-purple-700 to-purple-800 p-6 text-white">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm text-purple-200">Shared Journey</p>
                <h1 className="mt-1 text-2xl font-bold">
                  {journey.nickname?.trim() ? journey.nickname : "Lokal Journey"}
                </h1>
                <p className="mt-2 text-sm text-purple-100">
                  ETA to {destinationName} is {formatShareMinutes(journey.itineraryData.totalDurationMinutes)}.
                </p>
                <p className="mt-1 text-xs text-purple-200">
                  Saved on {createdDate.toLocaleDateString()} • {journey.itineraryData.legs.length} legs
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={handleShare}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/30 bg-white/20 px-4 py-2 text-sm font-medium transition hover:bg-white/30"
                  aria-label="Share journey"
                >
                  <Share2 className="h-4 w-4" />
                  {shareSuccess ? "Copied!" : "Share"}
                </button>
                <button
                  onClick={handleViewOnMap}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-purple-700 transition hover:bg-purple-50"
                >
                  <MapPin className="h-4 w-4" />
                  View in Lokal
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6 p-6">
            <div className="grid gap-4 rounded-lg border bg-white p-4 sm:grid-cols-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-purple-700">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Total Time</p>
                  <p className="text-sm text-muted-foreground">{formatShareMinutes(totalDurationMinutes)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Distance</p>
                  <p className="text-sm text-muted-foreground">{formatDistance(totalDistanceMeters)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-orange-700">
                  <BusFront className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Legs</p>
                  <p className="text-sm text-muted-foreground">{journey.itineraryData.legs.length}</p>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-foreground">Step-by-step directions</h2>
              <div className="mt-3 space-y-3">
                {journey.itineraryData.legs.map((leg, index) => (
                  <LegCard key={index} leg={leg} index={index} total={journey.itineraryData.legs.length} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function LegCard({ leg, index, total }: { leg: PlanLeg; index: number; total: number }) {
  const isWalk = leg.type === "walk";
  const isFirst = index === 0;
  const isLast = index === total - 1;

  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex items-start gap-3">
        <div
          className={`mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
            isWalk ? "bg-purple-100" : "bg-orange-100"
          }`}
        >
          {isWalk ? <Footprints className="h-5 w-5 text-purple-700" /> : <BusFront className="h-5 w-5 text-orange-700" />}
        </div>
        <div className="flex-1">
          {isWalk ? (
            <>
              <div className="font-semibold text-foreground">
                {isFirst ? "Walk to your starting stop" : isLast ? "Walk to your destination" : "Walk to the next stop"}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {formatDistance(leg.distanceMeters)} • {formatMinutes(leg.durationMinutes)}
              </div>
              {leg.endStopName && !isLast && (
                <div className="mt-2 text-sm">
                  <span className="font-medium">To:</span> {leg.endStopName}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="font-semibold text-foreground">
                Take {leg.routeName ?? `Route ${leg.routeNumber ?? ""}`}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {formatBusSummary(leg)}
              </div>
              {leg.startStopName && (
                <div className="mt-2 text-sm">
                  <span className="font-medium">From:</span> {leg.startStopName}
                </div>
              )}
              {leg.endStopName && (
                <div className="mt-1 text-sm">
                  <span className="font-medium">To:</span> {leg.endStopName}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function formatMinutes(value: number) {
  const rounded = Math.round(value);
  if (rounded <= 0) return "<1 min";
  return `${rounded} min${rounded === 1 ? "" : "s"}`;
}

function formatShareMinutes(value: number) {
  const rounded = Math.max(1, Math.round(value));
  return `${rounded} minute${rounded === 1 ? "" : "s"}`;
}

function formatDistance(distanceMeters: number) {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`;
  }
  const kilometres = distanceMeters / 1000;
  const decimals = kilometres >= 10 ? 0 : 1;
  return `${kilometres.toFixed(decimals)} km`;
}

function formatBusSummary(leg: PlanLeg) {
  const stopCount = Math.max((leg.stopCount ?? 1) - 1, 0);
  const stopLabel =
    stopCount <= 0 ? "non-stop" : stopCount === 1 ? "1 stop" : `${stopCount} stops`;
  return `${stopLabel} • ${formatMinutes(leg.durationMinutes)}`;
}
