import { MapboxMap } from "@/app/_components/map";
import { RoutesSidebar } from "@/app/_components/routes-sidebar";

export default function Home() {
  return (
    <main className="relative min-h-screen">
      <RoutesSidebar />
      <MapboxMap />
    </main>
  );
}
