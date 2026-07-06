import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL
});

async function main() {
  console.log('Seeding database with dummy leads...');

  const dummyLeads = [
    { name: 'John Doe', email: 'john@example.com', phone: '1234567890', source: 'Website', status: 'NEW' },
    { name: 'Jane Smith', email: 'jane@example.com', phone: '0987654321', source: 'Referral', status: 'CONTACTED' },
    { name: 'Mike Johnson', email: 'mike@example.com', phone: '5555555555', source: 'Social Media', status: 'CONVERTED' },
  ];

  for (const lead of dummyLeads) {
    await prisma.lead.create({
      // @ts-ignore
      data: lead
    });
  }

  console.log('🎉 3 Dummy Leads inserted successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
