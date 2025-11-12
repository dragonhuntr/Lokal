/**
 * Extracts context names from Mapbox API response context objects
 * Handles both array and object formats of context data
 */
export function extractContextNames(context: unknown): string[] {
  if (!context) return [];
  const entries: Array<{ name?: string | null }> = [];

  if (Array.isArray(context)) {
    context.forEach((e) => {
      if (e && typeof e === "object") {
        entries.push(e as { name?: string | null });
      }
    });
  } else if (typeof context === "object") {
    const values = Object.values(context as Record<string, unknown>);
    values.forEach((value) => {
      if (Array.isArray(value)) {
        value.forEach((e) => {
          if (e && typeof e === "object") {
            entries.push(e as { name?: string | null });
          }
        });
      } else if (value && typeof value === "object") {
        entries.push(value as { name?: string | null });
      }
    });
  }

  return Array.from(new Set(entries.map((e) => e.name).filter((n): n is string => typeof n === "string" && n.trim().length > 0)));
}
