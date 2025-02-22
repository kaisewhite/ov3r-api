import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({});

export const checkDatabaseConnection = async (): Promise<void> => {
  try {
    await prisma.$connect();
    console.log(`Connected to PostgreSQL database:${process.env.PGHOST}:${process.env.PGPORT}`);
    //await prisma.$disconnect();
  } catch (error) {
    console.log(`Error connecting to PostgreSQL database: ${process.env.PGHOST}:${process.env.PGPORT}`);

    process.exit(1);
  }
};

export default prisma;