import { PrismaClient } from "@prisma/client";

import { env } from "@/env";

const createPrismaClient = () =>
  new PrismaClient({
    log:
      env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    // Configure connection pooling for better performance
    // Pool size is automatically managed by Prisma based on DATABASE_URL connection limit
  });

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;

// Graceful shutdown to close database connections properly
// Prevents connection leaks and ensures clean shutdown
if (typeof process !== 'undefined') {
  const shutdown = async (signal: string) => {
    console.log(`${signal} received, closing database connections...`);
    await db.$disconnect();
    console.log('Database connections closed');
  };

  process.on('SIGINT', async () => {
    await shutdown('SIGINT');
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await shutdown('SIGTERM');
    process.exit(0);
  });

  process.on('beforeExit', async () => {
    await db.$disconnect();
  });
}

// Log database connection status in development
if (env.NODE_ENV === "development") {
  db.$connect()
    .then(() => console.log('Database connected successfully'))
    .catch((error) => console.error('Database connection error:', error));
}
