import dotenv from 'dotenv';
import path from 'path';

// Load env variables
dotenv.config({ path: path.join(__dirname, '../.env') });

import prisma from './models/prismaClient';
import { triggerHotFollowUp } from './services/emailAutomation';

async function test() {
  console.log("Starting test for lead 47637...");
  
  // Reset salesNotificationSent to false so it actually triggers
  await prisma.lead.update({
    where: { id: 47637 },
    data: { salesNotificationSent: false }
  });
  
  await triggerHotFollowUp(47637);
  
  // Check if salesNotificationSent was updated
  const lead = await prisma.lead.findUnique({
    where: { id: 47637 }
  });
  console.log("Lead salesNotificationSent after run:", lead?.salesNotificationSent);
  console.log("Test finished!");
}

test().catch(console.error);
