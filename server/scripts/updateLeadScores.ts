import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper to check if a field contains actual data and is not just a placeholder or "null" string
const hasValue = (val: any): boolean => {
  if (val === undefined || val === null) return false;
  const str = String(val).trim();
  return str !== '' && str.toLowerCase() !== 'null';
};

// Compute a deterministic lead score based on status components and data completeness
const getLeadScore = (lead: any): number => {
  let score = 0;

  // --- PART 1: STATUS COMPONENTS (Max 60 points) ---
  
  // 1. Sales Stage component (Max 20 points)
  switch (lead.salesStage) {
    case 'Client Won':
      score += 20;
      break;
    case 'Negotiation':
      score += 17;
      break;
    case 'Follow-up':
      score += 15;
      break;
    case 'Qualified':
      score += 12;
      break;
    case 'Contacted':
      score += 8;
      break;
    case 'New':
      score += 5;
      break;
    case 'Client Lost':
    case 'Do Not Contact':
      score += 0;
      break;
    default:
      score += 3;
  }

  // 2. Verification Status component (Max 15 points)
  switch (lead.verificationStatus) {
    case 'Active':
      score += 15;
      break;
    case 'Imported':
    case 'Enrichment Pending':
    case 'Unverified':
      score += 8;
      break;
    case 'Likely Inactive':
      score += 2;
      break;
    case 'Duplicate':
      score -= 15;
      break;
  }

  // 3. Engagement Status component (Max 15 points)
  switch (lead.engagementStatus) {
    case 'Demo Requested':
      score += 15;
      break;
    case 'Replied':
      score += 13;
      break;
    case 'Clicked':
      score += 11;
      break;
    case 'Opened':
      score += 8;
      break;
    case 'Delivered':
      score += 5;
      break;
    case 'Sent':
      score += 3;
      break;
    case 'Not Engaged':
    default:
      score += 0;
  }

  // 4. Consent Status component (Max 10 points)
  switch (lead.consentStatus) {
    case 'Opted In':
      score += 10;
      break;
    case 'Implied B2B':
      score += 7;
      break;
    case 'Unknown':
      score += 3;
      break;
    case 'Opted Out':
      score -= 15;
      break;
  }

  // --- PART 2: DATA COMPLETENESS & RICHNESS (Max 46 points) ---
  
  // 5. Contact Completeness (Max 8 points)
  if (hasValue(lead.email)) score += 3;
  if (hasValue(lead.email2)) score += 1;
  if (hasValue(lead.phone)) score += 3;
  if (hasValue(lead.phone2)) score += 1;

  // 6. Registration & Business Info (Max 10 points)
  if (hasValue(lead.registrationNo)) score += 5;
  if (hasValue(lead.type) && String(lead.type).toLowerCase() !== 'manual') score += 3;
  if (hasValue(lead.contactPerson)) score += 2;

  // 7. Location Info (Max 6 points)
  if (hasValue(lead.address)) score += 2;
  if (hasValue(lead.city)) score += 2;
  if (hasValue(lead.state)) score += 2;

  // 8. Online Presence (Max 8 points)
  if (hasValue(lead.website)) score += 4;
  if (hasValue(lead.logoUrl)) score += 2;
  if (hasValue(lead.linkedin) || hasValue(lead.facebook) || hasValue(lead.twitter)) score += 2;

  // 9. Enrichment Content (Max 14 points)
  if (lead.isEnriched) score += 3;
  if (hasValue(lead.servicesSummary)) score += 3;
  if (hasValue(lead.productsOffered)) score += 2;
  if (hasValue(lead.enrichmentNotes)) score += 2;
  if (lead.sellsAlgoTrading === 'Yes') score += 2;
  if (hasValue(lead.brokerPartner)) score += 2;

  // Clamp the score between 0 and 100
  return Math.max(0, Math.min(100, score));
};

async function main() {
  console.log('Fetching leads from database...');
  const leads = await prisma.lead.findMany();
  console.log(`Found ${leads.length} leads. Calculating and updating scores...`);

  let updatedCount = 0;

  for (const lead of leads) {
    const calculatedScore = getLeadScore(lead);
    
    // Only update if the score is actually different to save DB writes
    if (lead.leadScore !== calculatedScore) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { leadScore: calculatedScore }
      });
      updatedCount++;
    }
  }

  console.log(`Finished updating lead scores. Updated ${updatedCount} out of ${leads.length} leads.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
