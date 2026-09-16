const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const campaignsWithNullRuns = await prisma.messageSend.groupBy({
    by: ['campaignId'],
    where: { campaignRunId: null, campaignId: { not: null } }
  });

  for (const group of campaignsWithNullRuns) {
    const campaignId = group.campaignId;
    console.log(`Fixing legacy messages for campaign ${campaignId}...`);

    // Fetch existing runs for this campaign
    const existingRuns = await prisma.campaignRun.findMany({
      where: { campaignId },
      orderBy: { runNumber: 'asc' }
    });

    // If there is an existing Run 1, shift it to Run 2, etc.
    if (existingRuns.length > 0) {
      for (let i = existingRuns.length - 1; i >= 0; i--) {
        await prisma.campaignRun.update({
          where: { id: existingRuns[i].id },
          data: { runNumber: existingRuns[i].runNumber + 1 }
        });
      }
    }

    // Find the oldest messageSend for this campaign with null campaignRunId to use as the createdAt date for the new run
    const oldestMessage = await prisma.messageSend.findFirst({
      where: { campaignId, campaignRunId: null },
      orderBy: { createdAt: 'asc' }
    });

    // Create "Run 1" for the legacy messages
    const legacyRun = await prisma.campaignRun.create({
      data: {
        campaignId,
        runNumber: 1,
        status: 'COMPLETED',
        createdAt: oldestMessage ? oldestMessage.createdAt : new Date()
      }
    });

    // Link all legacy messages to this new run
    const result = await prisma.messageSend.updateMany({
      where: { campaignId, campaignRunId: null },
      data: { campaignRunId: legacyRun.id }
    });

    console.log(`Updated ${result.count} legacy messages to Run 1 for campaign ${campaignId}.`);
  }

  console.log('Migration complete.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
