import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Starting reset of BOUNCED leads...');

  // 1. Find all BOUNCED message sends
  const bouncedMessages = await prisma.messageSend.findMany({
    where: {
      status: 'BOUNCED'
    }
  });

  if (bouncedMessages.length === 0) {
    console.log('✅ No BOUNCED leads found.');
    return;
  }

  console.log(`Found ${bouncedMessages.length} BOUNCED messages. Resetting them to QUEUED...`);

  let count = 0;
  for (const msg of bouncedMessages) {
    // 2. Delete the EngagementEvent for this bounce
    await prisma.engagementEvent.deleteMany({
      where: {
        messageSendId: msg.id,
        eventType: 'BOUNCED'
      }
    });

    // 3. Update the MessageSend back to normal
    await prisma.messageSend.update({
      where: { id: msg.id },
      data: {
        status: 'QUEUED',
        bouncedAt: null,
        failureReason: null
      }
    });
    count++;
  }

  console.log(`✅ Successfully reset ${count} leads back to normal (QUEUED).`);
}

main()
  .catch((e) => {
    console.error('❌ Error resetting bounced leads:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
