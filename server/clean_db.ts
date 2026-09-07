import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.messageSend.deleteMany({});
  console.log('Successfully deleted all message history (MessageSend).');
}

main().finally(() => prisma.$disconnect());
