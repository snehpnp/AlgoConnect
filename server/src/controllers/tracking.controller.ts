import { Request, Response } from 'express';
import prisma from '../models/prismaClient';
import { asyncHandler } from '../utils/asyncHandler';

const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export const trackOpen = asyncHandler(async (req: Request, res: Response) => {
  const { emailLogId } = req.params;
  const logId = parseInt(emailLogId as string);

  if (!isNaN(logId)) {
    try {
      const emailLog = await prisma.emailLog.findUnique({
        where: { id: logId },
        include: { lead: true }
      });

      if (emailLog) {
        const now = new Date();
        
        // Update EmailLog
        await prisma.emailLog.update({
          where: { id: logId },
          data: {
            openedAt: emailLog.openedAt || now,
            status: 'opened'
          }
        });

        // Update Lead Engagement Status if not already Replied
        if (emailLog.lead && emailLog.lead.engagementStatus !== 'Replied') {
          await prisma.lead.update({
            where: { id: emailLog.leadId },
            data: {
              engagementStatus: 'Opened'
            }
          });

          // Log Activity
          await prisma.activityLog.create({
            data: {
              leadId: emailLog.leadId,
              action: 'EMAIL_OPENED',
              details: `Email "${emailLog.subject}" was opened. (Type: ${emailLog.emailType})`
            }
          });
        }
      }
    } catch (error) {
      console.error('[Tracking] Open tracking failed:', error);
    }
  }

  // Always return 1x1 pixel image
  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Content-Length': TRANSPARENT_GIF.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate, private'
  });
  res.end(TRANSPARENT_GIF);
});

export const trackClick = asyncHandler(async (req: Request, res: Response) => {
  const { emailLogId } = req.params;
  const destinationUrl = req.query.url as string;
  const logId = parseInt(emailLogId as string);

  if (!isNaN(logId)) {
    try {
      const emailLog = await prisma.emailLog.findUnique({
        where: { id: logId },
        include: { lead: true }
      });

      if (emailLog) {
        const now = new Date();

        // Update EmailLog
        await prisma.emailLog.update({
          where: { id: logId },
          data: {
            clickedAt: emailLog.clickedAt || now,
            status: 'clicked'
          }
        });

        // Update Lead Engagement Status if not already Replied
        if (emailLog.lead && emailLog.lead.engagementStatus !== 'Replied') {
          await prisma.lead.update({
            where: { id: emailLog.leadId },
            data: {
              engagementStatus: 'Opened' // Click counts as Opened / Engaged
            }
          });

          // Log Activity
          await prisma.activityLog.create({
            data: {
              leadId: emailLog.leadId,
              action: 'EMAIL_CLICKED',
              details: `Link clicked in email "${emailLog.subject}". (Type: ${emailLog.emailType}, Destination: ${destinationUrl})`
            }
          });
        }
      }
    } catch (error) {
      console.error('[Tracking] Click tracking failed:', error);
    }
  }

  // Redirect to original destination, fallback to '/' if not provided
  res.redirect(destinationUrl || '/');
});
