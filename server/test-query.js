const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  console.log('not: null :', await prisma.lead.count({ where: { email: { not: null } } }));
  console.log('not: "" :', await prisma.lead.count({ where: { email: { not: '' } } }));
  console.log('gt: "" :', await prisma.lead.count({ where: { email: { gt: '' } } }));
}
main().catch(console.error).finally(() => prisma.$disconnect());
