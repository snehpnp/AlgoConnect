import prisma from '../models/prismaClient';
import { getEmailTransporter, getEmailSenderId } from '../utils/emailService';

// Helper to replace placeholders like {{name}}, {{contact_name}}, {{company}}
const renderTemplate = (text: string, lead: any): string => {
  return text
    .replace(/{{name}}/g, lead.name || '')
    .replace(/{{contact_name}}/g, lead.contactPerson || lead.name || '')
    .replace(/{{company}}/g, lead.name || '');
};

// Helper to build segment where clause based on JSON rules
const buildSegmentWhereClause = (rules: any): any => {
  const whereClause: any = {};
  if (!rules) return whereClause;

  if (rules.entityType && rules.entityType !== 'All') whereClause.type = rules.entityType;
  if (rules.region && rules.region !== 'All') whereClause.state = { equals: rules.region, mode: 'insensitive' };
  if (rules.city && rules.city !== 'All') whereClause.city = { equals: rules.city, mode: 'insensitive' };
  if (rules.activityStatus && rules.activityStatus !== 'All') whereClause.verificationStatus = rules.activityStatus;
  
  if (rules.websiteStatus === 'NoWebsite') {
    if (!whereClause.AND) whereClause.AND = [];
    whereClause.AND.push({ OR: [{ website: null }, { website: '' }] });
  } else if (rules.websiteStatus === 'HasWebsite') {
    if (!whereClause.AND) whereClause.AND = [];
    whereClause.AND.push({ website: { not: null }, NOT: { website: '' } });
  }

  if (rules.algoStatus === 'HasAlgo') {
    if (!whereClause.AND) whereClause.AND = [];
    whereClause.AND.push({ sellsAlgoTrading: { contains: 'Yes', mode: 'insensitive' } });
  } else if (rules.algoStatus === 'NoAlgo') {
    if (!whereClause.AND) whereClause.AND = [];
    whereClause.AND.push({ OR: [{ sellsAlgoTrading: null }, { sellsAlgoTrading: '' }, { sellsAlgoTrading: { contains: 'No', mode: 'insensitive' } }] });
  }

  return whereClause;
};

// Main Helper to send email with tracking pixel and link rewriting
const sendEmailWithTracking = async (
  lead: any,
  subject: string,
  body: string,
  emailType: string,
  campaignId?: number
) => {
  let emailLogId: number | null = null;
  try {
    // 1. Create initial EmailLog record
    const emailLog = await prisma.emailLog.create({
      data: {
        leadId: lead.id,
        campaignId: campaignId || null,
        emailType,
        subject,
        status: 'sent',
        sentAt: new Date()
      }
    });
    emailLogId = emailLog.id;

    // Get mail client and configuration details
    let transporter;
    try {
      transporter = await getEmailTransporter();
    } catch (e) {
      console.warn('[EmailAutomation] Email IntegrationSettings not configured. Falling back to Mock sender.');
      transporter = {
        sendMail: async (mailOpts: any) => {
          console.log(`[MOCK EMAIL SEND] To: ${mailOpts.to}, Subject: ${mailOpts.subject}`);
          return { messageId: `mock_${Date.now()}` };
        }
      };
    }

    const sender = await getEmailSenderId().catch(() => 'noreply@algoconnect.com');

    // Generate tracking links & pixel
    const serverUrl = process.env.SERVER_URL || 'http://localhost:7701';
    const openPixel = `<img src="${serverUrl}/api/track/open/${emailLog.id}" width="1" height="1" style="display:none;" />`;

    const rewriteLinks = (html: string, logId: number): string => {
      return html.replace(/href="([^"]+)"/g, (match, url) => {
        if (url.startsWith('http://') || url.startsWith('https://')) {
          return `href="${serverUrl}/api/track/click/${logId}?url=${encodeURIComponent(url)}"`;
        }
        return match;
      });
    };

    // Render variables
    const finalSubject = renderTemplate(subject, lead);
    let finalBody = renderTemplate(body, lead);
    finalBody = rewriteLinks(finalBody, emailLog.id);

    const htmlBody = `<div style="font-family: sans-serif; white-space: pre-wrap;">${finalBody}</div>${openPixel}`;

    // Send email
    await transporter.sendMail({
      from: sender,
      to: lead.email,
      subject: finalSubject,
      html: htmlBody
    });

    // Update Lead engagement status if not replied
    if (lead.engagementStatus !== 'Replied') {
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          engagementStatus: lead.engagementStatus === 'Not Engaged' ? 'Sent' : lead.engagementStatus,
          lastEmailSentAt: new Date()
        }
      });
    }

    // Update EmailLog to delivered status
    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: {
        deliveredAt: new Date(),
        status: 'delivered'
      }
    });

    return { success: true, emailLogId };
  } catch (error: any) {
    console.error(`[EmailAutomation] Failed to send email to lead ${lead.id}:`, error);
    if (emailLogId) {
      await prisma.emailLog.update({
        where: { id: emailLogId },
        data: { status: 'failed' }
      }).catch(() => {});
    }
    return { success: false, error: error.message };
  }
};

/**
 * 1. Recompute Active/Likely Inactive statuses
 */
export const updateVerificationStatuses = async () => {
  console.log('[EmailAutomation] Running updateVerificationStatuses...');
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Leads created older than 60 days
  const leads = await prisma.lead.findMany({
    where: {
      createdAt: { lt: sixtyDaysAgo },
      isArchived: false
    },
    include: {
      emailLogs: {
        where: {
          OR: [
            { openedAt: { gte: thirtyDaysAgo } },
            { clickedAt: { gte: thirtyDaysAgo } },
            { repliedAt: { gte: thirtyDaysAgo } }
          ]
        }
      }
    }
  });

  let likelyInactiveCount = 0;
  let activeCount = 0;

  for (const lead of leads) {
    // If no open/click/reply in last 30 days, mark as Likely Inactive
    if (lead.emailLogs.length === 0) {
      if (lead.verificationStatus !== 'Likely Inactive') {
        await prisma.lead.update({
          where: { id: lead.id },
          data: { verificationStatus: 'Likely Inactive' }
        });
        likelyInactiveCount++;
      }
    } else {
      if (lead.verificationStatus !== 'Active') {
        await prisma.lead.update({
          where: { id: lead.id },
          data: { verificationStatus: 'Active' }
        });
        activeCount++;
      }
    }
  }

  // Also reset newer leads (<60 days) to Active if they were marked Likely Inactive
  const newerLeadsCount = await prisma.lead.updateMany({
    where: {
      createdAt: { gte: sixtyDaysAgo },
      verificationStatus: 'Likely Inactive'
    },
    data: {
      verificationStatus: 'Active'
    }
  });

  console.log(`[EmailAutomation] Verification status check complete. Marked ${likelyInactiveCount} as Likely Inactive, ${activeCount + newerLeadsCount.count} as Active.`);
};

/**
 * 2. Welcome Email sending
 */
export const runWelcomeEmails = async () => {
  console.log('[EmailAutomation] Running runWelcomeEmails...');
  const segments = await prisma.segment.findMany();
  let welcomeSent = 0;

  for (const segment of segments) {
    const rules = segment.rules as any || {};
    const whereClause = buildSegmentWhereClause(rules);

    // Query leads that matched this segment, are active, and have no EmailLogs
    const leads = await prisma.lead.findMany({
      where: {
        ...whereClause,
        isArchived: false,
        engagementStatus: { not: 'Replied' },
        demoRequested: false,
        email: { not: null, notIn: [''] },
        emailLogs: { none: {} } // No logs exist at all
      }
    });

    for (const lead of leads) {
      const subject = "Welcome to AlgoConnect! Let's get started";
      const body = "Hi {{name}},\n\nWelcome to AlgoConnect! We're excited to help you streamline your algorithmic trading CRM operations. Let us know if you'd like to schedule a personal demo.\n\nBest regards,\nAlgoConnect Team";
      
      const res = await sendEmailWithTracking(lead, subject, body, 'welcome');
      if (res.success) welcomeSent++;
    }
  }

  console.log(`[EmailAutomation] Welcome email checks complete. Sent: ${welcomeSent}`);
};

/**
 * 3. Nurture / Drip Sequence sending
 */
export const runDripFollowUps = async () => {
  console.log('[EmailAutomation] Running runDripFollowUps...');
  const leads = await prisma.lead.findMany({
    where: {
      isArchived: false,
      demoRequested: false,
      engagementStatus: { in: ['Not Engaged', 'Sent', 'Opened'] },
      followUpCount: { lt: 3 },
      lastEmailSentAt: { not: null },
      email: { not: null, notIn: [''] }
    }
  });

  let dripSent = 0;

  for (const lead of leads) {
    const diffMs = Date.now() - new Date(lead.lastEmailSentAt!).getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    let shouldSend = false;
    let nextType = '';
    let subject = '';
    let body = '';

    if (lead.followUpCount === 0 && diffDays >= 1) {
      // Day 1 Drip
      shouldSend = true;
      nextType = 'drip1';
      subject = 'Unlock the Power of Algo Trading with AlgoConnect';
      body = 'Hi {{name}},\n\nDid you know that AlgoConnect supports seamless integration with major broker APIs? Boost your trading execution speed today.\n\nBest regards,\nAlgoConnect Team';
    } else if (lead.followUpCount === 1 && diffDays >= 3) {
      // Day 4 Drip (3 days after Drip 1)
      shouldSend = true;
      nextType = 'drip2';
      subject = 'Case Study: How ABC Capital scaled with AlgoConnect';
      body = 'Hi {{name}},\n\nHere is how one of our clients improved their trading system uptime by 40% using AlgoConnect. Reply to this email to discuss how we can help you.\n\nBest regards,\nAlgoConnect Team';
    } else if (lead.followUpCount === 2 && diffDays >= 4) {
      // Day 8 Drip (4 days after Drip 2)
      shouldSend = true;
      nextType = 'drip3';
      subject = 'Exclusive Invitation: Interactive AlgoConnect Demo';
      body = 'Hi {{name}},\n\nThis is our final follow-up for now. We\'d love to show you a live interactive demo of the AlgoConnect platform. Let us know a convenient time.\n\nBest regards,\nAlgoConnect Team';
    }

    if (shouldSend) {
      const res = await sendEmailWithTracking(lead, subject, body, nextType);
      if (res.success) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            followUpCount: lead.followUpCount + 1
          }
        });
        dripSent++;
      }
    }
  }

  console.log(`[EmailAutomation] Drip follow-up complete. Sent: ${dripSent}`);
};

/**
 * 4. Re-engagement email sending
 */
export const runReengagementEmails = async () => {
  console.log('[EmailAutomation] Running runReengagementEmails...');
  const thresholdDays = 5;
  const thresholdDate = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000);

  const leads = await prisma.lead.findMany({
    where: {
      isArchived: false,
      demoRequested: false,
      engagementStatus: 'Opened',
      email: { not: null, notIn: [''] },
      emailLogs: {
        none: { emailType: 'reengage' } // Ensure no reengage email sent yet
      }
    },
    include: {
      emailLogs: {
        where: {
          openedAt: { not: null },
          repliedAt: null
        },
        orderBy: { openedAt: 'desc' }
      }
    }
  });

  let reengageSent = 0;

  for (const lead of leads) {
    // Find the latest open event log
    const latestOpen = lead.emailLogs[0];
    if (latestOpen && latestOpen.openedAt && new Date(latestOpen.openedAt) < thresholdDate) {
      const subject = "Are you still interested?";
      const body = "Hi {{name}},\n\nWe noticed you opened our previous emails but haven't got the chance to reply. Are you still looking for a robust algorithmic trading CRM? Let's connect!\n\nBest regards,\nAlgoConnect Team";
      
      const res = await sendEmailWithTracking(lead, subject, body, 'reengage');
      if (res.success) reengageSent++;
    }
  }

  console.log(`[EmailAutomation] Re-engagement complete. Sent: ${reengageSent}`);
};

/**
 * 5. Winback email sending & automated archiving
 */
export const runWinbackEmails = async () => {
  console.log('[EmailAutomation] Running runWinbackEmails...');
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Part 1: Archive leads with no response after winback mail
  const leadsToArchive = await prisma.lead.findMany({
    where: {
      isArchived: false,
      engagementStatus: { not: 'Replied' },
      emailLogs: {
        some: {
          emailType: 'winback',
          sentAt: { lt: sevenDaysAgo },
          openedAt: null,
          clickedAt: null,
          repliedAt: null
        }
      }
    }
  });

  for (const lead of leadsToArchive) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { isArchived: true }
    });

    await prisma.activityLog.create({
      data: {
        leadId: lead.id,
        action: 'LEAD_ARCHIVED',
        details: 'Lead archived due to no response within 7 days of Winback email.'
      }
    });
  }

  // Part 2: Send Winback emails to "Likely Inactive" leads
  const leadsToWinback = await prisma.lead.findMany({
    where: {
      verificationStatus: 'Likely Inactive',
      isArchived: false,
      engagementStatus: { not: 'Replied' },
      demoRequested: false,
      email: { not: null, notIn: [''] },
      emailLogs: {
        none: { emailType: 'winback' } // Ensure winback is only sent once
      }
    }
  });

  let winbackSent = 0;

  for (const lead of leadsToWinback) {
    const subject = "We miss you - Special Offer inside";
    const body = "Hi {{name}},\n\nIt's been a while since we last connected. We have added many new features to AlgoConnect. We'd love to have you back! Reply to this email to discuss.\n\nBest regards,\nAlgoConnect Team";

    const res = await sendEmailWithTracking(lead, subject, body, 'winback');
    if (res.success) winbackSent++;
  }

  console.log(`[EmailAutomation] Winback checks complete. Archived: ${leadsToArchive.length}, Winback Sent: ${winbackSent}`);
};

/**
 * 6. Product Launch Broadcast campaign sending
 */
export const sendBroadcastCampaign = async (subject: string, content: string) => {
  console.log('[EmailAutomation] Starting Manual Product Launch Broadcast...');
  const leads = await prisma.lead.findMany({
    where: {
      verificationStatus: 'Active',
      isArchived: false,
      engagementStatus: { not: 'Replied' },
      demoRequested: false,
      email: { not: null, notIn: [''] }
    }
  });

  let broadcastSent = 0;
  let broadcastFailed = 0;

  for (const lead of leads) {
    const res = await sendEmailWithTracking(lead, subject, content, 'broadcast');
    if (res.success) {
      broadcastSent++;
    } else {
      broadcastFailed++;
    }
  }

  console.log(`[EmailAutomation] Broadcast complete. Sent: ${broadcastSent}, Failed: ${broadcastFailed}`);
  return { total: leads.length, sent: broadcastSent, failed: broadcastFailed };
};

/**
 * 7. Event-driven Hot Follow-up notification
 */
export const triggerHotFollowUp = async (leadId: number) => {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId }
    });

    if (!lead || lead.salesNotificationSent) {
      return;
    }

    console.log(`[EmailAutomation] Triggering Hot Follow-up notification for lead ${leadId}...`);

    let transporter;
    try {
      transporter = await getEmailTransporter();
    } catch (e) {
      console.warn('[EmailAutomation] Email settings not configured. Mocking Sales Team Notification.');
      transporter = {
        sendMail: async (mailOpts: any) => {
          console.log(`[SALES NOTIFICATION MOCK] To: ${mailOpts.to}, Subject: ${mailOpts.subject}`);
          return { messageId: 'sales_mock' };
        }
      };
    }

    const sender = await getEmailSenderId().catch(() => 'noreply@algoconnect.com');
    const salesEmail = process.env.SALES_EMAIL;

    if (!salesEmail) {
      console.warn('[EmailAutomation] SALES_EMAIL environment variable is not defined in .env. Skipping Hot Follow-up notification.');
      return;
    }

    const subject = `[HOT LEAD ALERT] Lead "${lead.name}" needs immediate attention!`;
    const htmlBody = `
      <h2>Hot Lead Follow-up Needed!</h2>
      <p>A lead has engaged with the system and needs immediate attention.</p>
      <ul>
        <li><strong>Name:</strong> ${lead.name}</li>
        <li><strong>Email:</strong> ${lead.email || 'N/A'}</li>
        <li><strong>Phone:</strong> ${lead.phone || 'N/A'}</li>
        <li><strong>City/State:</strong> ${lead.city || 'N/A'}, ${lead.state || 'N/A'}</li>
        <li><strong>Status:</strong> ${lead.engagementStatus}</li>
      </ul>
      <p>Please contact the lead immediately. Automated marketing emails have been stopped for this lead.</p>
    `;

    // Send internal alert
    await transporter.sendMail({
      from: sender,
      to: salesEmail,
      subject,
      html: htmlBody
    });

    // Mark as sales notification sent
    await prisma.lead.update({
      where: { id: leadId },
      data: { salesNotificationSent: true }
    });

    console.log(`[EmailAutomation] Sales notification email successfully sent for lead ${leadId}`);
  } catch (error) {
    console.error(`[EmailAutomation] Error in triggerHotFollowUp for lead ${leadId}:`, error);
  }
};

/**
 * Checks and sends welcome email to a specific lead instantly if they qualify
 */
export const checkAndSendWelcomeEmail = async (leadId: number) => {
  try {
    const isEnabled = await prisma.automationSetting.findUnique({
      where: { key: 'cron_toggle_global' }
    });
    if (isEnabled && !isEnabled.isEnabled) {
      console.log('[EmailAutomation] Global automation is disabled. Skipping immediate welcome email.');
      return;
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { emailLogs: true }
    });

    if (!lead || lead.isArchived || lead.engagementStatus === 'Replied' || lead.demoRequested || !lead.email || lead.email.trim() === '') {
      return;
    }

    if (lead.emailLogs.length > 0) {
      return;
    }

    const segments = await prisma.segment.findMany();
    let matchesSegment = false;

    for (const segment of segments) {
      const rules = segment.rules as any || {};
      const whereClause = buildSegmentWhereClause(rules);

      const matched = await prisma.lead.findFirst({
        where: {
          id: leadId,
          ...whereClause
        }
      });

      if (matched) {
        matchesSegment = true;
        break;
      }
    }

    if (matchesSegment) {
      console.log(`[EmailAutomation] Lead ${leadId} matches segment. Sending welcome email instantly.`);
      const subject = "Welcome to AlgoConnect! Let's get started";
      const body = "Hi {{name}},\n\nWelcome to AlgoConnect! We're excited to help you streamline your algorithmic trading CRM operations. Let us know if you'd like to schedule a personal demo.\n\nBest regards,\nAlgoConnect Team";
      
      await sendEmailWithTracking(lead, subject, body, 'welcome');
    }
  } catch (error) {
    console.error(`[EmailAutomation] Error in checkAndSendWelcomeEmail for lead ${leadId}:`, error);
  }
};

