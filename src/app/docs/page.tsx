import dynamicImport from "next/dynamic";
import type { Metadata } from "next";

const SwaggerClient = dynamicImport(
  async () => {
    const mod = await import("./swagger-client");
    return mod.SwaggerClient;
  },
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center p-10 text-sm text-muted-foreground">
        Loading API documentation...
      </div>
    ),
  }
);

export const metadata: Metadata = {
  title: "API Documentation | Lokal",
  description: "Interactive Swagger UI for the Lokal HTTP API.",
};

export const dynamic = "force-dynamic";

export default function ApiDocsPage() {
  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto w-full max-w-6xl p-6 md:p-10">
        <div className="mb-6 space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">API Documentation</h1>
          <p className="text-sm text-muted-foreground">
            Swagger UI rendering the OpenAPI document served from <code>/api/docs</code>.
          </p>
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-background shadow-sm">
          <SwaggerClient url="/api/docs" />
        </div>
      </section>
    </main>
  );
}
