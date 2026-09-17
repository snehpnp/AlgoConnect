import { PrismaClient } from '@prisma/client';
import { findWebsiteFromSearch, scrapeWebsiteContactInfo } from '../src/services/leadScrape.service';

const prisma = new PrismaClient();

/**
 * 1. Database se leads ki IDs nikalne ka function jinki email nahi hai.
 */
async function getLeadsWithoutEmail() {
    const leads = await prisma.lead.findMany({
        where: {
            AND: [
                { OR: [{ email: null }, { email: '' }] },
                { OR: [{ scrapedEmail: null }, { scrapedEmail: '' }] }
            ]
        },
        select: {
            id: true
        }
    });
    return leads.map(lead => lead.id);
}

/**
 * 2. Scrape Lead Contact Info using INTERNAL Backend Service (No API Call)
 */
async function scrapeLead(id: number) {
    console.log(`⏳ Starting scrape for lead ID: ${id}`);
    try {
        const lead = await prisma.lead.findUnique({ where: { id } });
        if (!lead) {
            console.error(`❌ Lead ${id} not found.`);
            return;
        }

        let website = (lead.website || '').trim();
        let websiteDiscovered = false;
        const updateData: any = {};

        // If no website, try to find it first
        if (!website) {
            const discovered = await findWebsiteFromSearch(lead.name, lead.registrationNo || '');
            if (discovered) {
                website = discovered;
                websiteDiscovered = true;
                updateData.website = discovered;
                updateData.hasOwnWebsite = true;
            }
        }

        if (!website) {
            console.log(`⚠️ No website found for lead ID ${id}`);
            return;
        }

        // Scrape the website directly using the internal service
        const { htmlFound, emailFound, phoneFound } = await scrapeWebsiteContactInfo(website);

        if (emailFound) {
            updateData.scrapedEmail = emailFound;
            if (!lead.email) updateData.email = emailFound;
        }
        if (phoneFound) {
            updateData.scrapedPhone = phoneFound;
            if (!lead.phone) updateData.phone = phoneFound;
        }
        if (emailFound || phoneFound || websiteDiscovered) {
            updateData.isEnriched = true;
        }

        // Only update if we actually found something new
        if (Object.keys(updateData).length > 0) {
            await prisma.lead.update({ where: { id }, data: updateData });
            
            // Log the activity
            const parts = [
                websiteDiscovered ? `Website: ${website}.` : '',
                emailFound ? `Email: ${emailFound}.` : '',
                phoneFound ? `Phone: ${phoneFound}.` : '',
            ].filter(Boolean);

            await prisma.activityLog.create({
                data: {
                    userId: 1, // Default Admin User
                    action: 'SCRAPED_CONTACT_INFO',
                    details: `Scraped Lead #${lead.id}. ${parts.join(' ')}`,
                },
            });
            console.log(`✅ Success for lead ID ${id}. ${parts.join(' ')}`);
        } else {
            console.log(`⚠️ Scraped website for lead ID ${id} but found no new info.`);
        }

    } catch (error: any) {
        console.error(`❌ Error for lead ID ${id}:`, error.message);
    }
}

/**
 * 3. Concurrency Handle karne wala function
 */
async function runWithConcurrency(leadIds: number[], concurrencyLimit: number) {
    const queue = [...leadIds];

    async function worker(workerId: number) {
        while (queue.length > 0) {
            const id = queue.shift();
            if (id !== undefined) {
                console.log(`[Worker ${workerId}] picked up ID: ${id}. Remaining in queue: ${queue.length}`);
                await scrapeLead(id);
            }
        }
    }

    const workers = [];
    for (let i = 1; i <= concurrencyLimit; i++) {
        workers.push(worker(i));
    }

    await Promise.all(workers);
    console.log("🎉 All scraping tasks completed!");
}

async function main() {
    console.log("Fetching leads from DB...");
    const leadIds = await getLeadsWithoutEmail();
    console.log("leadIds", leadIds)
    
    if (leadIds.length === 0) {
        console.log('✅ No leads without email found.');
        return;
    }

    console.log(`Found ${leadIds.length} leads without email. Starting scrape with 3 concurrent workers...`);
    
    await runWithConcurrency(leadIds, 3);
}

main()
  .catch((e) => {
    console.error('❌ Error in scraping leads:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
