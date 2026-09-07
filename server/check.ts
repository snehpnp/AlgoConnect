import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const m = await prisma.messageSend.findMany({ include: { events: true } });
  console.dir(m, { depth: null });
}
main().finally(() => prisma.$disconnect());
