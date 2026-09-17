import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixCampaignRuns() {
  console.log('Fetching campaigns to fix null campaignRunIds...');
  const campaigns = await prisma.campaign.findMany({ 
    include: { 
      runs: { orderBy: { id: 'asc' } } 
    } 
  });

  let totalFixed = 0;

  for (const c of campaigns) {
    if (c.runs.length > 0) {
      const firstRun = c.runs[0];
      const result = await prisma.messageSend.updateMany({
        where: { campaignId: c.id, campaignRunId: null },
        data: { campaignRunId: firstRun.id }
      });
      if (result.count > 0) {
        totalFixed += result.count;
        console.log(`Fixed ${result.count} messages in campaign ${c.id} by assigning them to run ${firstRun.id}`);
      }
    }
  }

  console.log(`\nDone! Successfully fixed ${totalFixed} messages in total.`);
}

fixCampaignRuns()
  .catch((e) => {
    console.error('Error fixing campaign runs:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
