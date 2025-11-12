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
let shutdownInProgress = false;

if (typeof process !== 'undefined') {
  const shutdown = async (signal: string): Promise<void> => {
    if (shutdownInProgress) {
      console.log('Shutdown already in progress, skipping...');
      return;
    }

    shutdownInProgress = true;
    console.log(`${signal} received, closing database connections...`);

    try {
      await Promise.race([
        db.$disconnect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Database disconnect timeout')), 10000)
        )
      ]);
      console.log('Database connections closed successfully');
    } catch (error) {
      console.error('Error during database disconnect:', error);
    } finally {
      process.exit(signal === 'SIGINT' ? 0 : 1);
    }
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  process.once('beforeExit', (code) => {
    if (!shutdownInProgress && code === 0) {
      void db.$disconnect().catch(console.error);
    }
  });
}

// Log database connection status in development
if (env.NODE_ENV === "development") {
  db.$connect()
    .then(() => console.log('Database connected successfully'))
    .catch((error) => console.error('Database connection error:', error));
}
