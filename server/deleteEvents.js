const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.engagementEvent.deleteMany().then(() => console.log('Deleted')).catch(console.error).finally(() => prisma.$disconnect());
