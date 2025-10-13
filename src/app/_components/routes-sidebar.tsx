"use client";

import { useMemo, useState } from "react";
import { api } from "@/trpc/react";
import * as Dialog from "@radix-ui/react-dialog";
import { ScrollArea, Scrollbar } from "@radix-ui/react-scroll-area";
import { Menu, X, Search } from "lucide-react";
// import { cn } from "@/lib/utils";

export function RoutesSidebar() {
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState("");
  const { data: routes, isLoading } = api.bus.getRoutes.useQuery();

  const filtered = useMemo(() => {
    if (!routes) return [];
    const q = query.trim().toLowerCase();
    if (!q) return routes;
    return routes.filter((r) =>
      [r.ShortName, r.LongName, r.Description]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q))
    );
  }, [routes, query]);

  return (
    <div className="pointer-events-none absolute left-4 top-4 z-50">
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>
          <button
            className="pointer-events-auto inline-flex h-10 items-center gap-2 rounded-md bg-white/90 px-3 text-sm shadow-md backdrop-blur hover:bg-white"
            aria-label="Toggle routes sidebar"
          >
            <Menu className="h-4 w-4" />
            Routes
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Content className="pointer-events-auto fixed inset-y-4 left-4 z-50 w-[320px] rounded-lg border bg-background p-3 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <Dialog.Title className="text-base font-semibold">Routes</Dialog.Title>
              <Dialog.Close asChild>
                <button className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>

            <div className="mb-3 flex items-center gap-2 rounded-md border bg-card px-2">
              <Search className="h-4 w-4 opacity-60" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search routes..."
                className="h-9 w-full bg-transparent text-sm outline-none"
              />
            </div>

            <div className="text-xs opacity-60 mb-2">
              {isLoading ? "Loading routes..." : `${filtered.length} routes`}
            </div>

            <div className="h-[60vh] overflow-hidden rounded-md border">
              <ScrollArea type="auto" className="h-full w-full">
                <ul className="divide-y">
                  {filtered.map((route) => (
                    <li key={route.RouteId} className="group">
                      <button
                        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/60"
                        title={route.LongName}
                      >
                        <span
                          className="inline-block h-3 w-3 rounded"
                          style={{ backgroundColor: `#${route.Color}` }}
                          aria-hidden
                        />
                        <span className="min-w-[2.5rem] text-xs font-semibold tabular-nums">
                          {route.ShortName}
                        </span>
                        <span className="truncate text-sm">{route.LongName}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <Scrollbar orientation="vertical" />
              </ScrollArea>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

// no-op placeholder removed


