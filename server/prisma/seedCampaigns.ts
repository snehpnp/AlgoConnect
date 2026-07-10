import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL
});

async function main() {

  const dummyCampaigns = [
    { name: 'Tech Enterprise Q3 Outreach', type: 'EMAIL', status: 'ACTIVE' },
    { name: 'SaaS Startup Inbound Autoresponder', type: 'EMAIL', status: 'ACTIVE' },
    { name: 'Finance Broker Lead Activation', type: 'SMS', status: 'DRAFT' },
    { name: 'Automotive Dealership Retargeting', type: 'WHATSAPP', status: 'DRAFT' },
  ];

  for (const camp of dummyCampaigns) {
    await prisma.campaign.create({ data: camp });
  }

  const dummyActivities = [
    { action: 'Campaign Started', details: 'Tech Enterprise Q3 Outreach was activated' },
    { action: 'New Lead Added', details: 'John Doe was added from Website' },
    { action: 'Lead Status Updated', details: 'Jane Smith is now CONTACTED' },
  ];

  for (const act of dummyActivities) {
    await prisma.activityLog.create({ data: act });
  }

}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
