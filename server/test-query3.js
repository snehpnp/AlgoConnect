const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const email = 'DEEPAKPAL6364@GMAIL.COM';
  const data = await prisma.engagementEvent.findMany({
    where: {
      messageSend: {
        channel: 'EMAIL',
        lead: {
          OR: [
            { email: { contains: email, mode: 'insensitive' } },
            { scrapedEmail: { contains: email, mode: 'insensitive' } },
            { phone: { contains: email, mode: 'insensitive' } },
            { name: { contains: email, mode: 'insensitive' } }
          ]
        }
      }
    },
    take: 5
  });
  console.log('Result length:', data.length);
}
main().catch(console.error).finally(() => process.exit(0));
