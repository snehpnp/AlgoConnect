import { Request, Response } from 'express';
import prisma from '../models/prismaClient';
import { asyncHandler } from '../utils/asyncHandler';
import { sendEmail, getEmailSenderId } from '../utils/emailService';

export const getCampaigns = asyncHandler(async (req: Request, res: Response) => {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      segments: { select: { id: true, name: true } },
      _count: {
        select: { leads: true }
      }
    }
  });
  res.status(200).json({ data: campaigns, message: 'Campaigns retrieved successfully' });
});

export const getCampaignById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const campaign = await prisma.campaign.findUnique({
    where: { id: parseInt(id as string) },
    include: {
      segments: { select: { id: true, name: true } },
      automations: true,
      leads: { select: { id: true, name: true, email: true, phone: true } },
      _count: { select: { leads: true } }
    }
  });

  if (!campaign) {
    throw new Error('Campaign not found');
  }
  res.status(200).json({ data: campaign, message: 'Campaign retrieved successfully' });
});

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmail = (email: string | null | undefined): boolean => {
  if (!email || typeof email !== 'string' || email.trim() === '') return false;
  return EMAIL_REGEX.test(email.trim());
};

export const getEmailPriorityRank = (email: string | null | undefined): number => {
  if (!isValidEmail(email)) return 3; // Rank 3: Invalid or Empty Email (Last)
  const trimmed = email!.trim().toLowerCase();
  if (trimmed.endsWith('@gmail.com')) return 1; // Rank 1: Valid @gmail.com (First)
  return 2; // Rank 2: Other valid email domains (@yahoo.com, custom domain, etc.)
};

// ─── Segment Helpers ─────────────────────────────────────────────────────────

export const buildWhereClauseFromSegmentRules = (rules: any): any => {
  if (!rules || typeof rules !== 'object') return {};

  const whereClause: any = {};
  
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

  if (rules.exchangeName && rules.exchangeName !== 'All') {
    whereClause.exchangeName = rules.exchangeName;
  }
  
  if (rules.otherListings === 'Yes') {
    if (!whereClause.AND) whereClause.AND = [];
    whereClause.AND.push({ otherListings: { not: null }, NOT: { otherListings: '' } });
  } else if (rules.otherListings === 'No') {
    if (!whereClause.AND) whereClause.AND = [];
    whereClause.AND.push({ OR: [{ otherListings: null }, { otherListings: '' }] });
  }

  return whereClause;
};

export const getLeadsForSegments = async (segments: any[]): Promise<{ id: number; email?: string | null; scrapedEmail?: string | null }[]> => {
  if (!segments || segments.length === 0) return [];

  const orClauses: any[] = [];
  let matchAllLeads = false;

  for (const segment of segments) {
    const rules = segment.rules as any || {};
    const whereClause = buildWhereClauseFromSegmentRules(rules);
    if (Object.keys(whereClause).length === 0) {
      matchAllLeads = true;
      break;
    } else {
      orClauses.push(whereClause);
    }
  }

  let leads: { id: number; email: string | null; scrapedEmail: string | null }[] = [];

  if (matchAllLeads) {
    leads = await prisma.lead.findMany({ select: { id: true, email: true, scrapedEmail: true } });
  } else if (orClauses.length > 0) {
    leads = await prisma.lead.findMany({
      where: { OR: orClauses },
      select: { id: true, email: true, scrapedEmail: true }
    });
  }

  // Priority Sort: 1) Valid @gmail.com, 2) Other valid emails, 3) Invalid/empty emails (at the end)
  leads.sort((a, b) => {
    const rankA = getEmailPriorityRank(a.email || a.scrapedEmail);
    const rankB = getEmailPriorityRank(b.email || b.scrapedEmail);
    if (rankA !== rankB) return rankA - rankB;
    const emailA = (a.email || a.scrapedEmail || '').toLowerCase();
    const emailB = (b.email || b.scrapedEmail || '').toLowerCase();
    return emailA.localeCompare(emailB);
  });

  return leads;
};

export const isLeadInSegment = (lead: any, rules: any): boolean => {
  if (!rules || typeof rules !== 'object' || Object.keys(rules).length === 0) return true;

  if (rules.entityType && rules.entityType !== 'All') {
    if (lead.type !== rules.entityType) return false;
  }
  if (rules.region && rules.region !== 'All') {
    if (!lead.state || lead.state.toLowerCase() !== rules.region.toLowerCase()) return false;
  }
  if (rules.city && rules.city !== 'All') {
    if (!lead.city || lead.city.toLowerCase() !== rules.city.toLowerCase()) return false;
  }
  if (rules.activityStatus && rules.activityStatus !== 'All') {
    if (lead.verificationStatus !== rules.activityStatus) return false;
  }
  if (rules.websiteStatus === 'NoWebsite') {
    if (lead.website && lead.website.trim() !== '') return false;
  } else if (rules.websiteStatus === 'HasWebsite') {
    if (!lead.website || lead.website.trim() === '') return false;
  }
  if (rules.algoStatus === 'HasAlgo') {
    if (!lead.sellsAlgoTrading || !lead.sellsAlgoTrading.toLowerCase().includes('yes')) return false;
  } else if (rules.algoStatus === 'NoAlgo') {
    if (lead.sellsAlgoTrading && lead.sellsAlgoTrading.toLowerCase().includes('yes')) return false;
  }
  if (rules.exchangeName && rules.exchangeName !== 'All') {
    if (lead.exchangeName !== rules.exchangeName) return false;
  }
  if (rules.otherListings === 'Yes') {
    if (!lead.otherListings || lead.otherListings.trim() === '') return false;
  } else if (rules.otherListings === 'No') {
    if (lead.otherListings && lead.otherListings.trim() !== '') return false;
  }

  return true;
};

// ─── Connected Leads ──────────────────────────────────────────────────────────

export const getCampaignConnectedLeads = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const campaignId = parseInt(id as string);

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      segments: true,
      leads: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          scrapedEmail: true,
          scrapedPhone: true,
          type: true,
          state: true,
          city: true,
          verificationStatus: true,
          website: true,
          sellsAlgoTrading: true,
          exchangeName: true,
          otherListings: true,
          messageSends: {
            where: { campaignId },
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              events: {
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
              replies: {
                orderBy: { receivedAt: 'desc' },
                take: 1
              }
            }
          }
        }
      }
    }
  });

  if (!campaign) {
    throw new Error('Campaign not found');
  }

  const formattedLeads = campaign.leads.map(lead => {
    const lastMessageSend = lead.messageSends[0];
    const lastEvent = lastMessageSend?.events[0];
    let latestReply: any = lastMessageSend?.replies?.[0] || null;
    
    if (lastEvent?.eventType === 'REPLY' && lastEvent?.metadataJson) {
      const meta = lastEvent.metadataJson as any;
      if (meta.text) {
        latestReply = {
          subject: 'WhatsApp Reply',
          body: meta.text,
          receivedAt: lastEvent.createdAt
        };
      }
    }
    
    let status = 'PENDING';
    if (latestReply) {
       status = 'REPLIED';
    } else if (lastEvent) {
       if (lastEvent.eventType === 'LIMIT_REACHED') {
         status = 'PENDING (Limit Exceeded)';
       } else {
         status = lastEvent.eventType;
       }
    } else if (lastMessageSend) {
       status = lastMessageSend.status;
    }

    const matchingSegmentNames = (campaign.segments || [])
      .filter((seg: any) => isLeadInSegment(lead, seg.rules))
      .map((seg: any) => seg.name);

    return {
      id: lead.id,
      name: lead.name,
      email: lead.email || lead.scrapedEmail,
      phone: lead.phone || lead.scrapedPhone,
      status: status,
      segments: matchingSegmentNames.length > 0 ? matchingSegmentNames : (campaign.segments?.map(s => s.name) || []),
      segmentDisplay: matchingSegmentNames.length > 0 ? matchingSegmentNames.join(', ') : (campaign.segments && campaign.segments.length > 0 ? campaign.segments.map(s => s.name).join(', ') : 'Manual Selection'),
      latestReply: latestReply || null,
      lastInteractionAt: latestReply?.receivedAt || lastEvent?.createdAt || lastMessageSend?.createdAt || null
    };
  });

  // Priority Sort: 1) Valid @gmail.com, 2) Other valid email, 3) Invalid/empty email (at the end)
  formattedLeads.sort((a, b) => {
    const rankA = getEmailPriorityRank(a.email);
    const rankB = getEmailPriorityRank(b.email);
    if (rankA !== rankB) return rankA - rankB;
    return (a.email || '').toLowerCase().localeCompare((b.email || '').toLowerCase());
  });

  res.status(200).json({ data: formattedLeads, message: 'Connected leads retrieved successfully' });
});

export const createCampaign = asyncHandler(async (req: Request, res: Response) => {
  const { name, type, status, segmentIds, leadIds, description, channels, schedule, emailTemplateId, whatsappTemplateId, smsTemplateId } = req.body;

  if (!name || !type) {
    throw new Error('Name and type are required');
  }

  const data: any = { 
    name, 
    description,
    type, 
    channels,
    status: status || 'DRAFT',
    schedule: schedule ? new Date(schedule) : null,
    emailTemplateId: emailTemplateId ? parseInt(emailTemplateId) : null,
    whatsappTemplateId: whatsappTemplateId ? parseInt(whatsappTemplateId) : null,
    smsTemplateId: smsTemplateId ? parseInt(smsTemplateId) : null
  };

  // If segments are assigned, automatically fetch and connect all matching leads
  if (segmentIds && Array.isArray(segmentIds) && segmentIds.length > 0) {
    const segments = await prisma.segment.findMany({ 
      where: { id: { in: segmentIds.map(id => parseInt(id as any)) } } 
    });
    
    if (segments.length > 0) {
      data.segments = {
        connect: segments.map(s => ({ id: s.id }))
      };

      const matchingLeads = await getLeadsForSegments(segments);

      const allLeadIds = new Set<number>();
      matchingLeads.forEach(l => allLeadIds.add(l.id));
      if (leadIds && Array.isArray(leadIds)) {
        leadIds.forEach(id => allLeadIds.add(parseInt(id as any)));
      }

      if (allLeadIds.size > 0) {
        data.leads = {
          connect: Array.from(allLeadIds).map(id => ({ id }))
        };
      }
    }
  } else if (leadIds && Array.isArray(leadIds) && leadIds.length > 0) {
    data.leads = {
      connect: leadIds.map(id => ({ id: parseInt(id as any) }))
    };
  }

  const newCampaign = await prisma.campaign.create({
    data,
    include: {
      segments: { select: { id: true, name: true } },
      _count: { select: { leads: true } }
    }
  });

  res.status(201).json({ message: 'Campaign created successfully', data: newCampaign });
});

export const updateCampaign = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, type, status, segmentIds, leadIds, description, channels, schedule, emailTemplateId, whatsappTemplateId, smsTemplateId } = req.body;

  const dataToUpdate: any = { name, type, status, description, channels };
  if (schedule !== undefined) dataToUpdate.schedule = schedule ? new Date(schedule) : null;
  if (emailTemplateId !== undefined) dataToUpdate.emailTemplateId = emailTemplateId ? parseInt(emailTemplateId) : null;
  if (whatsappTemplateId !== undefined) dataToUpdate.whatsappTemplateId = whatsappTemplateId ? parseInt(whatsappTemplateId) : null;
  if (smsTemplateId !== undefined) dataToUpdate.smsTemplateId = smsTemplateId ? parseInt(smsTemplateId) : null;

  if (segmentIds !== undefined) {
    if (Array.isArray(segmentIds) && segmentIds.length > 0) {
      const segments = await prisma.segment.findMany({ 
        where: { id: { in: segmentIds.map(id => parseInt(id as any)) } } 
      });
      
      if (segments.length > 0) {
        dataToUpdate.segments = {
          set: segments.map(s => ({ id: s.id }))
        };

        const matchingLeads = await getLeadsForSegments(segments);

        const allLeadIds = new Set<number>();
        matchingLeads.forEach(l => allLeadIds.add(l.id));
        if (leadIds && Array.isArray(leadIds)) {
          leadIds.forEach(id => allLeadIds.add(parseInt(id as any)));
        }

        dataToUpdate.leads = {
          set: Array.from(allLeadIds).map(id => ({ id }))
        };
      }
    } else {
      dataToUpdate.segments = { set: [] };
      if (leadIds && Array.isArray(leadIds) && leadIds.length > 0) {
        dataToUpdate.leads = { set: leadIds.map(id => ({ id: parseInt(id as any) })) };
      } else {
        dataToUpdate.leads = { set: [] };
      }
    }
  } else if (leadIds !== undefined) {
    if (Array.isArray(leadIds) && leadIds.length > 0) {
      dataToUpdate.leads = { set: leadIds.map(id => ({ id: parseInt(id as any) })) };
    } else {
      dataToUpdate.leads = { set: [] };
    }
  }

  const campaign = await prisma.campaign.update({
    where: { id: parseInt(id as string) },
    data: dataToUpdate,
    include: {
      segments: { select: { id: true, name: true } },
      _count: { select: { leads: true } }
    }
  });

  res.status(200).json({ message: 'Campaign updated successfully', data: campaign });
});

export const deleteCampaign = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  await prisma.campaign.delete({
    where: { id: parseInt(id as string) }
  });

  res.status(200).json({ message: 'Campaign deleted successfully' });
});

export const addLeadsToCampaign = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { leadIds } = req.body;

  if (!leadIds || !Array.isArray(leadIds)) {
    throw new Error('leadIds must be an array');
  }

  const campaign = await prisma.campaign.update({
    where: { id: parseInt(id as string) },
    data: {
      leads: {
        connect: leadIds.map((leadId: number) => ({ id: leadId }))
      }
    },
    include: {
      _count: { select: { leads: true } }
    }
  });

  res.status(200).json({ message: 'Leads added to campaign successfully', data: campaign });
});

export const removeLeadFromCampaign = asyncHandler(async (req: Request, res: Response) => {
  const { id, leadId } = req.params;

  const campaign = await prisma.campaign.update({
    where: { id: parseInt(id as string) },
    data: {
      leads: {
        disconnect: { id: parseInt(leadId as string) }
      }
    },
    include: {
      _count: { select: { leads: true } }
    }
  });

  res.status(200).json({ message: 'Lead removed from campaign successfully', data: campaign });
});

export const getCampaignStats = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const campaignId = parseInt(id as string);
  
  const messageSends = await prisma.messageSend.findMany({
    where: { campaignId },
    select: { id: true }
  });
  
  const messageSendIds = messageSends.map(ms => ms.id);
  
  const engagements = await prisma.engagementEvent.groupBy({
    by: ['eventType'],
    where: { messageSendId: { in: messageSendIds } },
    _count: {
      eventType: true
    }
  });

  res.status(200).json({ data: { sends: [], engagements } });
});

export const getCampaignLogs = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  const [logsRaw, total] = await Promise.all([
    prisma.engagementEvent.findMany({
      where: { messageSend: { campaignId: parseInt(id as string) } },
      include: {
        messageSend: {
          include: {
            lead: {
              select: { id: true, name: true, email: true, phone: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.engagementEvent.count({
      where: { messageSend: { campaignId: parseInt(id as string) } }
    })
  ]);

  const logs = logsRaw.map(log => ({
    ...log,
    lead: log.messageSend?.lead,
    campaignId: log.messageSend?.campaignId
  }));

  res.status(200).json({
    data: logs,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  });
});

import { toggleEngine, getEngineState } from '../services/campaignRunner.service';

export const getEngineStatus = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json({ data: { isRunning: getEngineState() } });
});

export const toggleEngineStatus = asyncHandler(async (req: any, res: Response) => {
  const { isRunning } = req.body;
  const newState = toggleEngine(isRunning);
  
  await prisma.activityLog.create({
    data: {
      userId: req.user?.id,
      action: newState ? 'ENGINE_STARTED' : 'ENGINE_STOPPED',
      details: `Campaign Automation Engine was ${newState ? 'started' : 'stopped'} by ${req.user?.name || 'User'}`,
    }
  });

  res.status(200).json({ data: { isRunning: newState }, message: newState ? 'Engine started' : 'Engine stopped' });
});

export const getEngineLogs = asyncHandler(async (req: Request, res: Response) => {
  const logs = await prisma.activityLog.findMany({
    where: {
      action: {
        in: ['ENGINE_STARTED', 'ENGINE_STOPPED']
      }
    },
    include: {
      user: { select: { id: true, name: true, email: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 100
  });
  res.status(200).json({ data: logs, message: 'Engine logs retrieved successfully' });
});

export const sendManualMessage = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { leadId, channel, templateId, message } = req.body;

  if (!leadId || !channel) {
    throw new Error('leadId and channel are required');
  }

  const lead = await prisma.lead.findUnique({ where: { id: parseInt(leadId as string) } });
  if (!lead) throw new Error('Lead not found');

  let content = message || '';
  let subject = 'Message from AlgoConnect';

  if (templateId) {
    const template = await prisma.messageTemplate.findUnique({ where: { id: parseInt(templateId) } });
    if (template) {
      content = template.content;
      subject = template.subject || subject;
    }
  }

  if (!content) {
    throw new Error('Message content is required');
  }

  content = content
    .replace(/{{name}}/g, lead.name || '')
    .replace(/{{contact_name}}/g, lead.contactPerson || lead.name || '')
    .replace(/{{company}}/g, lead.name || '');

  let recipient = '';
  const providerMessageId = `manual-${Date.now()}`;
  let htmlSent = '';

  if (channel === 'EMAIL') {
    recipient = lead.email || lead.scrapedEmail || lead.email2 || '';
    if (!recipient) throw new Error('Lead has no email address');

    // Generate tracking URL (fallback to localhost for local testing)
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:7700';
    const trackingPixel = `<img src="${backendUrl}/api/track/open/${providerMessageId}" width="1" height="1" style="display:none;" alt="" />`;
    
    htmlSent = `<div style="font-family: sans-serif; white-space: pre-wrap;">${content}</div>${trackingPixel}`;

    try {
      const sender = await getEmailSenderId();
      await sendEmail({
        from: `"Deepmind Infotech" <` + (sender) + `>`,
        to: recipient,
        subject,
        html: htmlSent,
        messageId: `${providerMessageId}@algoconnect.local`
      });
    } catch (err: any) {
      const msg = await prisma.messageSend.create({
        data: {
          leadId: lead.id,
          campaignId: parseInt(id as string),
          channel,
          subject,
          status: 'FAILED',
          providerMessageId: `manual-failed-${Date.now()}`
        }
      });
      await prisma.engagementEvent.create({
        data: {
          messageSendId: msg.id,
          eventType: 'FAILED',
          metadataJson: { isManual: true, error: err.message }
        }
      });
      throw new Error(`Failed to send email: ${err.message}`);
    }
  } else {
    // For SMS/Whatsapp, ensure phone exists
    recipient = lead.phone || lead.scrapedPhone || lead.phone2 || '';
    if (!recipient) throw new Error(`Lead has no phone number for ${channel}`);
    htmlSent = content;
    console.log(`[Mock] Sending ${channel} to ${recipient}: ${content}`);
  }

  const msg = await prisma.messageSend.create({
    data: {
      leadId: parseInt(leadId as string),
      campaignId: parseInt(id as string),
      channel,
      subject,
      status: 'SENT',
      providerMessageId
    }
  });

  await prisma.engagementEvent.create({
    data: {
      messageSendId: msg.id,
      eventType: 'SENT',
      metadataJson: { isManual: true }
    }
  });

  res.status(200).json({ message: 'Message sent successfully', data: msg });
});
