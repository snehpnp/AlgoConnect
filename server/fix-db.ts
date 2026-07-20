import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.lead.updateMany({
    data: {
      salesStage: 'New',
      verificationStatus: 'Unverified',
      engagementStatus: 'Not Engaged',
      status: 'IMPORTED'
    }
  });
  
  console.log('Reset leads:', result.count);
}

main().catch(console.error).finally(() => prisma.$disconnect());
