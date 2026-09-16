const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({log:['query']});
async function main() {
  const data = await prisma.engagementEvent.findMany({
    where: {
      messageSend: {
        channel: 'EMAIL',
        lead: {
          OR: [
            { email: { contains: 'DEEPAKPAL', mode: 'insensitive' } }
          ]
        }
      }
    },
    take: 1
  });
  console.log('Result:', data);
}
main().catch(console.error).finally(() => prisma.$disconnect());
