import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config();


const prisma = new PrismaClient();

export default prisma;