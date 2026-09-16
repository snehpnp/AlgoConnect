import { PrismaClient } from '@prisma/client';
import { scrapeWebsiteContactInfo } from './src/services/leadScrape.service';

const prisma = new PrismaClient();

async function run() {
  console.log('Fetching leads with missing emails...');
  
  // Find leads where email AND scrapedEmail are missing or empty
  const leadsWithoutEmail = await prisma.lead.findMany({
    where: {
      OR: [
        { email: null },
        { email: '' }
      ],
      AND: [
        { OR: [{ scrapedEmail: null }, { scrapedEmail: '' }] }
      ]
    }
  });

  console.log(`Found ${leadsWithoutEmail.length} leads without email.`);

  const stillMissing = [];

  for (let i = 0; i < leadsWithoutEmail.length; i++) {
    const lead = leadsWithoutEmail[i];
    console.log(`Processing ${i + 1}/${leadsWithoutEmail.length}: ${lead.name}`);

    let foundEmail = null;

    if (lead.website && lead.website.trim() !== '') {
      try {
        console.log(`  Scraping website: ${lead.website}`);
        const scrapeResult = await scrapeWebsiteContactInfo(lead.website);
        if (scrapeResult && scrapeResult.emailFound) {
          foundEmail = scrapeResult.emailFound;
          console.log(`  -> Found email: ${foundEmail}`);
          
          await prisma.lead.update({
            where: { id: lead.id },
            data: { scrapedEmail: foundEmail, isEnriched: true }
          });
        } else {
          console.log(`  -> No email found on website.`);
        }
      } catch (err: any) {
        console.error(`  -> Error scraping website:`, err.message);
      }
    } else {
      console.log(`  -> No website to scrape.`);
    }

    if (!foundEmail) {
      stillMissing.push(lead.name);
    }
  }

  console.log('\n--- SCRAPE COMPLETE ---');
  if (stillMissing.length > 0) {
    console.log(`There are ${stillMissing.length} leads that STILL don't have an email.`);
    console.log('You will need to manually find emails for these names:');
    stillMissing.forEach(name => console.log(`- ${name}`));
  } else {
    console.log('Amazing! All leads now have an email.');
  }
}

run()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
