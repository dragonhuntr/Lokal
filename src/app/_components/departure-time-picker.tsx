"use client";

import { useState, useEffect } from "react";
import { Clock, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { DataSource } from "@/server/routing/service";

interface DepartureTimePickerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  dataSource?: DataSource;
  disabled?: boolean;
}

function formatDateTimeLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseDateTimeLocal(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (isNaN(date.getTime())) return null;
  return date;
}

function getDataSourceLabel(dataSource?: DataSource): string {
  switch (dataSource) {
    case "realtime":
      return "Using real-time data";
    case "scheduled":
      return "Using scheduled times";
    case "estimated":
    default:
      return "Using estimated times";
  }
}

function getDataSourceColor(dataSource?: DataSource): string {
  switch (dataSource) {
    case "realtime":
      return "text-green-600";
    case "scheduled":
      return "text-blue-600";
    case "estimated":
    default:
      return "text-gray-600";
  }
}

export function DepartureTimePicker({
  value,
  onChange,
  dataSource,
  disabled = false,
}: DepartureTimePickerProps) {
  const [isNow, setIsNow] = useState(!value);
  const [localValue, setLocalValue] = useState<string>("");

  // Initialize local value from prop
  useEffect(() => {
    if (value && !isNow) {
      setLocalValue(formatDateTimeLocal(value));
    } else {
      setLocalValue("");
    }
  }, [value, isNow]);

  const handleToggle = (newIsNow: boolean) => {
    setIsNow(newIsNow);
    if (newIsNow) {
      onChange(null);
      setLocalValue("");
    } else {
      // Set to current time when switching to "specific time"
      const now = new Date();
      onChange(now);
      setLocalValue(formatDateTimeLocal(now));
    }
  };

  const handleDateTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = parseDateTimeLocal(e.target.value);
    setLocalValue(e.target.value);
    if (newDate) {
      onChange(newDate);
    }
  };

  // Set minimum datetime to now (rounded to nearest 5 minutes)
  const now = new Date();
  const roundedMinutes = Math.ceil(now.getMinutes() / 5) * 5;
  const minDate = new Date(now);
  minDate.setMinutes(roundedMinutes);
  minDate.setSeconds(0);
  minDate.setMilliseconds(0);
  
  // Set maximum datetime to 7 days from now
  const maxDate = new Date(now);
  maxDate.setDate(maxDate.getDate() + 7);
  
  const minDateTimeLocal = formatDateTimeLocal(minDate);
  const maxDateTimeLocal = formatDateTimeLocal(maxDate);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => handleToggle(true)}
          disabled={disabled}
          className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
            isNow
              ? "border-blue-500 bg-blue-50 text-blue-700"
              : "border-border bg-background text-muted-foreground hover:bg-muted"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <Clock className="h-4 w-4" />
          Leave now
        </button>
        <button
          type="button"
          onClick={() => handleToggle(false)}
          disabled={disabled}
          className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
            !isNow
              ? "border-blue-500 bg-blue-50 text-blue-700"
              : "border-border bg-background text-muted-foreground hover:bg-muted"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <Calendar className="h-4 w-4" />
          Leave at specific time
        </button>
      </div>

      {!isNow && (
        <div className="space-y-2">
          <Input
            type="datetime-local"
            value={localValue}
            onChange={handleDateTimeChange}
            min={minDateTimeLocal}
            max={maxDateTimeLocal}
            disabled={disabled}
            className="w-full"
          />
          {dataSource && (
            <div className={`flex items-center gap-1 text-xs ${getDataSourceColor(dataSource)}`}>
              <Clock className="h-3 w-3" />
              <span>{getDataSourceLabel(dataSource)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

