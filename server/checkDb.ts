import prisma from './src/models/prismaClient';

async function main() {
  console.log('--- DATABASE DIAGNOSTIC START ---');
  
  const leadCount = await prisma.lead.count();
  console.log('Total Leads:', leadCount);
  
  const latestLead = await prisma.lead.findFirst({
    orderBy: { createdAt: 'desc' }
  });
  console.log('Latest Lead:', latestLead);

  const segmentCount = await prisma.segment.count();
  console.log('Total Segments:', segmentCount);
  
  const segments = await prisma.segment.findMany();
  console.log('Segments:', JSON.stringify(segments, null, 2));

  const emailSettings = await prisma.integrationSetting.findUnique({
    where: { type: 'EMAIL' }
  });
  console.log('Email Settings Configured:', !!emailSettings);
  if (emailSettings) {
    console.log('Email Host:', emailSettings.host);
    console.log('Email SenderId:', emailSettings.senderId);
  }

  const logsCount = await prisma.emailLog.count();
  console.log('Total Email Logs:', logsCount);
  
  const latestLogs = await prisma.emailLog.findMany({
    take: 5,
    orderBy: { sentAt: 'desc' },
    include: { lead: { select: { id: true, name: true, email: true } } }
  });
  console.log('Latest Logs:', JSON.stringify(latestLogs, null, 2));

  console.log('--- DATABASE DIAGNOSTIC END ---');
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
