const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const email = 'DEEPAKPAL6364@GMAIL.COM';
  const data = await prisma.engagementEvent.findMany({
    where: {
      OR: [
        {
          messageSend: {
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
        // We can't search inside JSON directly with Prisma easily on all DBs unless it's Postgres with special ops.
        // But maybe we can cast it? Or we can search in `providerPayload` if they used it.
      ]
    },
    take: 5
  });
  console.log('Result length:', data.length);
}
main().catch(console.error).finally(() => process.exit(0));
