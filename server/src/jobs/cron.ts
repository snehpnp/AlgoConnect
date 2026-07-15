import cron from 'node-cron';
import prisma from '../models/prismaClient';
import {
  updateVerificationStatuses,
  runWelcomeEmails,
  runDripFollowUps,
  runReengagementEmails,
  runWinbackEmails
} from '../services/emailAutomation';

/**
 * Checks if the global cron toggle is enabled.
 * Automatically seeds the toggle setting if it doesn't exist in the database.
 */
const getGlobalToggleState = async (): Promise<boolean> => {
  try {
    let setting = await prisma.automationSetting.findUnique({
      where: { key: 'cron_toggle_global' }
    });

    if (!setting) {
      setting = await prisma.automationSetting.create({
        data: {
          key: 'cron_toggle_global',
          isEnabled: true
        }
      });
    }

    return setting.isEnabled;
  } catch (error) {
    console.error('[CronJob] Error fetching global toggle state:', error);
    // Safe default to true if database retrieval fails
    return true;
  }
};

/**
 * Main function to execute the daily email automation sequence.
 */
export const runDailyEmailAutomationSequence = async () => {
  const isEnabled = await getGlobalToggleState();
  if (!isEnabled) {
    console.log('[CronJob] Global email automation is disabled (cron_toggle_global is false). Exiting daily sequence.');
    return;
  }

  console.log('[CronJob] Starting daily email automation sequence...');
  try {
    // 1. Recompute Active/Likely Inactive for all leads first
    await updateVerificationStatuses();

    // 2. Run Welcome emails
    await runWelcomeEmails();

    // 3. Run Drip sequence
    await runDripFollowUps();

    // 4. Run Re-engagement emails
    await runReengagementEmails();

    // 5. Run Winback sequence
    await runWinbackEmails();

    console.log('[CronJob] Daily email automation sequence completed successfully.');
  } catch (error) {
    console.error('[CronJob] Error executing daily email automation sequence:', error);
  }
};

/**
 * Initializes and schedules the email automation cron job.
 * Runs once daily at 9:00 AM ('0 9 * * *').
 */
export const startEmailAutomationCron = () => {
  console.log('[CronJob] Initializing email automation scheduler...');
  
  // Schedule to run daily at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    await runDailyEmailAutomationSequence();
  });
  
  console.log('[CronJob] Email automation scheduled to run daily at 9:00 AM.');
};
