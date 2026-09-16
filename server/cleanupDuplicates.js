const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanDuplicates() {
  console.log('Starting cleanup of duplicate SENT events...');
  
  // Find all SENT events
  const sentEvents = await prisma.engagementEvent.findMany({
    where: { eventType: 'SENT' },
    orderBy: { id: 'asc' }
  });

  const grouped = {};
  for (const event of sentEvents) {
    if (!grouped[event.messageSendId]) {
      grouped[event.messageSendId] = [];
    }
    grouped[event.messageSendId].push(event);
  }

  let deletedCount = 0;

  for (const [msgId, events] of Object.entries(grouped)) {
    if (events.length > 1) {
      // Keep the one with htmlContent in metadata (the full one), or the last one if neither
      const toKeep = events.find(e => {
        let meta = e.metadataJson;
        if (typeof meta === 'string') {
            try { meta = JSON.parse(meta); } catch(e){}
        }
        return meta && meta.htmlContent;
      }) || events[events.length - 1];
      
      for (const event of events) {
        if (event.id !== toKeep.id) {
          await prisma.engagementEvent.delete({ where: { id: event.id } });
          deletedCount++;
        }
      }
    }
  }

  console.log(`Cleanup complete! Deleted ${deletedCount} duplicate SENT logs.`);
}

cleanDuplicates()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
