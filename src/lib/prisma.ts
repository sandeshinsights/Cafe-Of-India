import { PrismaClient } from "@prisma/client";

/**
 * Prisma Client Singleton
 * 
 * In development, Next.js hot-reloads and creates multiple Prisma clients.
 * This prevents that by reusing a single instance.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;