import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting Lead Status Migration...');
  const leads = await prisma.lead.findMany();
  console.log(`Found ${leads.length} leads to process.`);

  const higherSalesStages = ['Client Won', 'CONVERTED', 'Client Lost', 'Negotiation', 'Qualified'];
  const higherEngagement = ['Replied', 'Demo Requested', 'Clicked', 'Opened'];
  const contactedEngagement = ['Sent', 'Delivered'];

  let updatedCount = 0;

  for (const lead of leads) {
    let newStatus = 'UNVERIFIED';

    const stage = lead.salesStage || '';
    const engagement = lead.engagementStatus || '';
    const verification = lead.verificationStatus || '';

    // 1. Sales Stage Priority
    if (higherSalesStages.includes(stage)) {
      newStatus = stage.toUpperCase() === 'CONVERTED' ? 'WON' : stage.toUpperCase();
      if (newStatus === 'CLIENT WON') newStatus = 'WON';
      if (newStatus === 'CLIENT LOST') newStatus = 'LOST';
    } 
    // 2. Engagement Priority
    else if (higherEngagement.includes(engagement)) {
      newStatus = 'ENGAGED';
    } 
    // 3. Contacted Priority
    else if (contactedEngagement.includes(engagement)) {
      newStatus = 'CONTACTED';
    } 
    // 4. Verification Priority
    else if (verification === 'Active') {
      newStatus = 'NEW';
    } else if (verification === 'Unverified') {
      newStatus = 'UNVERIFIED';
    } else if (verification === 'Likely Inactive') {
      newStatus = 'INVALID';
    } else if (stage === 'New' || stage === 'NEW') {
      newStatus = 'NEW';
    } else {
      newStatus = 'IMPORTED';
    }

    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: newStatus }
    });
    updatedCount++;
  }

  console.log(`Successfully migrated ${updatedCount} leads.`);
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
