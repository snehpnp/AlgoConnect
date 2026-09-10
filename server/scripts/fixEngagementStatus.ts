import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Fixing engagement statuses for existing leads...');
  
  // Update leads to 'Sent' if they have a SENT message and are currently Not Engaged
  const leadsWithSent = await prisma.lead.findMany({
    where: { 
      engagementStatus: 'Not Engaged',
      messageSends: { some: { status: 'SENT' } }
    }
  });

  if (leadsWithSent.length > 0) {
    console.log(`Updating ${leadsWithSent.length} leads to 'Sent'`);
    for (const lead of leadsWithSent) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { engagementStatus: 'Sent' }
      });
    }
  }

  // Update leads to 'Opened' if they have an OPENED message and are currently Not Engaged or Sent
  const leadsWithOpened = await prisma.lead.findMany({
    where: { 
      engagementStatus: { in: ['Not Engaged', 'Sent', 'Delivered'] },
      messageSends: { some: { status: 'OPENED' } }
    }
  });

  if (leadsWithOpened.length > 0) {
    console.log(`Updating ${leadsWithOpened.length} leads to 'Opened'`);
    for (const lead of leadsWithOpened) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { engagementStatus: 'Opened' }
      });
    }
  }
  
  console.log('Done!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
