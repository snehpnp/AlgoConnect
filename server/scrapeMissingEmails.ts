import { PrismaClient } from '@prisma/client';
import { scrapeWebsiteContactInfo } from './src/services/leadScrape.service';

const prisma = new PrismaClient();

async function run() {

  
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

  
  const stillMissing = [];

  for (let i = 0; i < leadsWithoutEmail.length; i++) {
    const lead = leadsWithoutEmail[i];
  
    let foundEmail = null;

    if (lead.website && lead.website.trim() !== '') {
      try {
       
        const scrapeResult = await scrapeWebsiteContactInfo(lead.website);
        if (scrapeResult && scrapeResult.emailFound) {
          foundEmail = scrapeResult.emailFound;
         
          
          await prisma.lead.update({
            where: { id: lead.id },
            data: { scrapedEmail: foundEmail, isEnriched: true }
          });
        }
      } catch (err: any) {
        console.error(`  -> Error scraping website:`, err.message);
      }
    } 

    if (!foundEmail) {
      stillMissing.push(lead.name);
    }
  }


 
}

run()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
