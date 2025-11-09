"use client";

import { useState, useEffect } from "react";
import { X, MapPin, Bus, Bookmark, Clock } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";

const ONBOARDING_STORAGE_KEY = "lokal_onboarding_completed";

export function OnboardingOverlay() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Check if user has completed onboarding
    const completed = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!completed) {
      // Show onboarding after a short delay
      setTimeout(() => setOpen(true), 1000);
    }
  }, []);

  const handleComplete = () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    setOpen(false);
  };

  const handleSkip = () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    setOpen(false);
  };

  const steps = [
    {
      title: "Welcome to Lokal",
      description: "Your smart companion for navigating local transit. Let's show you around!",
      icon: Bus,
      color: "text-blue-600",
    },
    {
      title: "Find Your Route",
      description: "Search for bus routes or places to get real-time transit directions tailored to you.",
      icon: MapPin,
      color: "text-green-600",
    },
    {
      title: "Save Your Favorites",
      description: "Save frequently used routes for quick access. Perfect for your daily commute or regular trips.",
      icon: Bookmark,
      color: "text-purple-600",
    },
    {
      title: "Track Your History",
      description: "View past journeys and quickly repeat trips. Never lose track of your favorite routes.",
      icon: Clock,
      color: "text-orange-600",
    },
  ];

  const currentStep = steps[step];
  const Icon = currentStep?.icon;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] w-[min(90vw,480px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 shadow-2xl">
          <button
            onClick={handleSkip}
            className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="mt-2">
            <div className="mb-6 flex justify-center">
              {Icon && (
                <div className={`rounded-full bg-muted p-4 ${currentStep.color}`}>
                  <Icon className="h-12 w-12" />
                </div>
              )}
            </div>

            <Dialog.Title className="mb-2 text-center text-2xl font-bold">
              {currentStep?.title}
            </Dialog.Title>

            <Dialog.Description className="mb-6 text-center text-muted-foreground">
              {currentStep?.description}
            </Dialog.Description>

            <div className="mb-6 flex justify-center gap-2">
              {steps.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setStep(index)}
                  className={`h-2 rounded-full transition-all ${
                    index === step ? "w-8 bg-foreground" : "w-2 bg-muted-foreground/30"
                  }`}
                  aria-label={`Go to step ${index + 1}`}
                />
              ))}
            </div>

            <div className="flex gap-3">
              {step > 0 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className="flex-1 rounded-md border px-4 py-3 text-sm font-medium hover:bg-muted"
                >
                  Previous
                </button>
              )}
              {step < steps.length - 1 ? (
                <button
                  onClick={() => setStep(step + 1)}
                  className="flex-1 rounded-md bg-foreground px-4 py-3 text-sm font-medium text-background hover:opacity-90"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleComplete}
                  className="flex-1 rounded-md bg-foreground px-4 py-3 text-sm font-medium text-background hover:opacity-90"
                >
                  Get Started
                </button>
              )}
            </div>

            <button
              onClick={handleSkip}
              className="mt-3 w-full text-center text-sm text-muted-foreground hover:text-foreground"
            >
              Skip tutorial
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
