import prisma from './models/prismaClient';

async function main() {
  try {
    // 1. Total Leads
    const totalLeads = await prisma.lead.count();

    const leadsByStageRaw = await prisma.lead.groupBy({ by: ['salesStage'], _count: { salesStage: true } });
    const newLeads = await prisma.lead.count({ where: { salesStage: 'New' } });
    
    // Coverage stats
    const withEmail = await prisma.lead.count({
      where: { OR: [{ email: { not: null, not: '' } }, { scrapedEmail: { not: null, not: '' } }] }
    });
    const withEmail2 = await prisma.lead.count({ where: { email2: { not: null, not: '' } } });
    const withPhone = await prisma.lead.count({
      where: { OR: [{ phone: { not: null, not: '' } }, { scrapedPhone: { not: null, not: '' } }, { phone2: { not: null, not: '' } }] }
    });
    const withWebsite = await prisma.lead.count({ where: { website: { not: null, not: '' } } });
    const withAlgo = await prisma.lead.count({ where: { sellsAlgoTrading: { contains: 'Yes', mode: 'insensitive' } } });
    const withOtherListings = await prisma.lead.count({ where: { otherListings: { not: null, not: '' } } });
    
    const exchangeStatsRaw = await prisma.lead.groupBy({
      by: ['exchangeName'],
      _count: { exchangeName: true },
      where: { exchangeName: { not: null, not: '' } }
    });
    
    const wonLeadsByTypeRaw = await prisma.lead.groupBy({
      by: ['type'],
      where: { salesStage: 'Client Won' },
      _count: { type: true }
    });
    
    const campaignsRaw = await prisma.campaign.findMany({
      select: { id: true, name: true, type: true, _count: { select: { messageSends: true } } }
    });
    
    const campaignSuccessRaw = await prisma.messageSend.groupBy({
      by: ['campaignId'],
      where: { status: 'REPLIED', campaignId: { not: null } },
      _count: { id: true }
    });
    
    const recentCommunicationsRaw = await prisma.engagementEvent.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        messageSend: {
          include: {
            lead: { select: { id: true, name: true, email: true, phone: true } },
            campaign: { select: { id: true, name: true, type: true } }
          }
        }
      }
    });

    console.log("SUCCESS!");
  } catch(e) {
    console.error("ERROR CAUGHT: ", e);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
