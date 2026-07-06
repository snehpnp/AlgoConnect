import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

console.log("DATABASE_URL:", process.env.DATABASE_URL);

const prisma = new PrismaClient();

export default prisma;