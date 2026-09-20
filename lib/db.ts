import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const databaseUrl = process.env.DATABASE_URL?.replace(/^mysql:\/\//, "mariadb://");
const poolUrl = new URL(databaseUrl!);
poolUrl.searchParams.set("connectionLimit", "5");
poolUrl.searchParams.set("acquireTimeout", "30000");
poolUrl.searchParams.set("connectTimeout", "10000");
const adapter = new PrismaMariaDb(poolUrl.toString());

export const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
