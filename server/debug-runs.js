const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const runs = await prisma.campaignRun.findMany({
    select: { id: true, campaignId: true, runNumber: true, createdAt: true }
  });
  console.log('--- RUNS ---');
  console.log(runs);

  const messages = await prisma.messageSend.findMany({
    select: { id: true, campaignId: true, campaignRunId: true, status: true }
  });
  console.log('--- MESSAGES ---');
  // just count them
  console.log('Total messages:', messages.length);
  const byRun = {};
  for (const m of messages) {
    byRun[m.campaignRunId] = (byRun[m.campaignRunId] || 0) + 1;
  }
  console.log('Messages by Run ID:', byRun);
}

main().catch(console.error).finally(() => prisma.$disconnect());
