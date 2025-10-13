"use client";

import { useMemo, useState } from "react";
import { api } from "@/trpc/react";
import * as Dialog from "@radix-ui/react-dialog";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import { Menu, X, Search } from "lucide-react";

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
          <Dialog.Content className="pointer-events-auto fixed inset-y-4 left-4 z-50 w-[320px] rounded-lg border bg-background p-3 shadow-xl flex flex-col overflow-hidden box-border">
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

            <div className="flex-1 min-h-0">
              <ScrollArea.Root className="h-full w-full overflow-hidden rounded-md border">
                <ScrollArea.Viewport className="h-full w-full overflow-x-hidden">
                  <ul className="space-y-2 p-2 pr-3">
                  {filtered.map((route) => {
                    const color = `#${(route.Color ?? "").trim()}`;
                    const subtitle = route.Description && route.Description.length > 0 ? route.Description : "";
                    return (
                      <li key={route.RouteId}>
                        <button
                          className="relative w-full max-w-full overflow-hidden rounded-2xl border bg-card px-4 py-4 text-left shadow-sm transition hover:shadow-md"
                          title={route.LongName}
                        >
                          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                            <div className="min-w-0">
                              <div className="text-sm text-muted-foreground truncate">
                                {subtitle || route.LongName}
                              </div>
                              <div className="mt-1 truncate text-2xl font-semibold tracking-tight text-foreground">
                                {route.LongName || route.ShortName}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">On Time</div>
                            </div>
                            <div className="text-right">
                              <span
                                className="block leading-none text-5xl font-extrabold tabular-nums tracking-tighter"
                                style={{ color }}
                              >
                                {route.ShortName.includes("Route ") ? route.ShortName.split("Route ")[1] : route.ShortName}
                              </span>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                  </ul>
                </ScrollArea.Viewport>
                <ScrollArea.Scrollbar orientation="vertical">
                  <ScrollArea.Thumb className="rounded-full bg-border/60" />
                </ScrollArea.Scrollbar>
                <ScrollArea.Corner />
              </ScrollArea.Root>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}


