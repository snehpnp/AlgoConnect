const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  console.log('Campaigns:', await prisma.campaign.count());
  console.log('Lead exchange:', await prisma.lead.groupBy({ by: ['exchangeName'], _count: { exchangeName: true } }));
  console.log('Lead type:', await prisma.lead.count({ where: { sellsAlgoTrading: { contains: 'Yes', mode: 'insensitive' } } }));
  console.log('With Email:', await prisma.lead.count({ where: { OR: [{ email: { not: null, not: '' } }, { scrapedEmail: { not: null, not: '' } }] } }));
}
main().catch(console.error).finally(() => prisma.$disconnect());
