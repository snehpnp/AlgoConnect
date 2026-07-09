import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const sqlScript = `
CREATE OR REPLACE FUNCTION calculate_lead_score_trigger()
RETURNS TRIGGER AS $$
DECLARE
  score INTEGER := 0;
BEGIN
  -- 1. Sales Stage component (Max 20 points)
  CASE NEW."salesStage"
    WHEN 'Client Won' THEN score := score + 20;
    WHEN 'Negotiation' THEN score := score + 17;
    WHEN 'Follow-up' THEN score := score + 15;
    WHEN 'Qualified' THEN score := score + 12;
    WHEN 'Contacted' THEN score := score + 8;
    WHEN 'New' THEN score := score + 5;
    ELSE score := score + 3;
  END CASE;

  -- 2. Verification Status component (Max 15 points)
  CASE NEW."verificationStatus"
    WHEN 'Active' THEN score := score + 15;
    WHEN 'Imported' THEN score := score + 8;
    WHEN 'Enrichment Pending' THEN score := score + 8;
    WHEN 'Unverified' THEN score := score + 8;
    WHEN 'Likely Inactive' THEN score := score + 2;
    WHEN 'Duplicate' THEN score := score - 15;
    ELSE score := score + 0;
  END CASE;

  -- 3. Engagement Status component (Max 15 points)
  CASE NEW."engagementStatus"
    WHEN 'Demo Requested' THEN score := score + 15;
    WHEN 'Replied' THEN score := score + 13;
    WHEN 'Clicked' THEN score := score + 11;
    WHEN 'Opened' THEN score := score + 8;
    WHEN 'Delivered' THEN score := score + 5;
    WHEN 'Sent' THEN score := score + 3;
    ELSE score := score + 0;
  END CASE;

  -- 4. Consent Status component (Max 10 points)
  CASE NEW."consentStatus"
    WHEN 'Opted In' THEN score := score + 10;
    WHEN 'Implied B2B' THEN score := score + 7;
    WHEN 'Unknown' THEN score := score + 3;
    WHEN 'Opted Out' THEN score := score - 15;
    ELSE score := score + 0;
  END CASE;

  -- --- PART 2: DATA COMPLETENESS & RICHNESS (Max 46 points) ---
  
  -- 5. Contact Completeness (Max 8 points)
  IF NEW.email IS NOT NULL AND NEW.email <> '' AND LOWER(NEW.email) <> 'null' THEN score := score + 3; END IF;
  IF NEW.email2 IS NOT NULL AND NEW.email2 <> '' AND LOWER(NEW.email2) <> 'null' THEN score := score + 1; END IF;
  IF NEW.phone IS NOT NULL AND NEW.phone <> '' AND LOWER(NEW.phone) <> 'null' THEN score := score + 3; END IF;
  IF NEW.phone2 IS NOT NULL AND NEW.phone2 <> '' AND LOWER(NEW.phone2) <> 'null' THEN score := score + 1; END IF;

  -- 6. Registration & Business Info (Max 10 points)
  IF NEW."registrationNo" IS NOT NULL AND NEW."registrationNo" <> '' AND LOWER(NEW."registrationNo") <> 'null' THEN score := score + 5; END IF;
  IF NEW.type IS NOT NULL AND NEW.type <> '' AND LOWER(NEW.type) <> 'manual' AND LOWER(NEW.type) <> 'null' THEN score := score + 3; END IF;
  IF NEW."contactPerson" IS NOT NULL AND NEW."contactPerson" <> '' AND LOWER(NEW."contactPerson") <> 'null' THEN score := score + 2; END IF;

  -- 7. Location Info (Max 6 points)
  IF NEW.address IS NOT NULL AND NEW.address <> '' AND LOWER(NEW.address) <> 'null' THEN score := score + 2; END IF;
  IF NEW.city IS NOT NULL AND NEW.city <> '' AND LOWER(NEW.city) <> 'null' THEN score := score + 2; END IF;
  IF NEW.state IS NOT NULL AND NEW.state <> '' AND LOWER(NEW.state) <> 'null' THEN score := score + 2; END IF;

  -- 8. Online Presence (Max 8 points)
  IF NEW.website IS NOT NULL AND NEW.website <> '' AND LOWER(NEW.website) <> 'null' THEN score := score + 4; END IF;
  IF NEW."logoUrl" IS NOT NULL AND NEW."logoUrl" <> '' AND LOWER(NEW."logoUrl") <> 'null' THEN score := score + 2; END IF;
  IF (NEW.linkedin IS NOT NULL AND NEW.linkedin <> '' AND LOWER(NEW.linkedin) <> 'null') OR
     (NEW.facebook IS NOT NULL AND NEW.facebook <> '' AND LOWER(NEW.facebook) <> 'null') OR
     (NEW.twitter IS NOT NULL AND NEW.twitter <> '' AND LOWER(NEW.twitter) <> 'null') THEN
    score := score + 2;
  END IF;

  -- 9. Enrichment Content (Max 14 points)
  IF NEW."isEnriched" = TRUE THEN score := score + 3; END IF;
  IF NEW."servicesSummary" IS NOT NULL AND NEW."servicesSummary" <> '' AND LOWER(NEW."servicesSummary") <> 'null' THEN score := score + 3; END IF;
  IF NEW."productsOffered" IS NOT NULL AND NEW."productsOffered" <> '' AND LOWER(NEW."productsOffered") <> 'null' THEN score := score + 2; END IF;
  IF NEW."enrichmentNotes" IS NOT NULL AND NEW."enrichmentNotes" <> '' AND LOWER(NEW."enrichmentNotes") <> 'null' THEN score := score + 2; END IF;
  IF NEW."sellsAlgoTrading" = 'Yes' THEN score := score + 2; END IF;
  IF NEW."brokerPartner" IS NOT NULL AND NEW."brokerPartner" <> '' AND LOWER(NEW."brokerPartner") <> 'null' THEN score := score + 2; END IF;

  -- Clamp score between 0 and 100
  IF score < 0 THEN score := 0; ELSIF score > 100 THEN score := 100; END IF;

  NEW."leadScore" := score;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

`;

async function main() {
  console.log("Applying lead score trigger function to database...");
  await prisma.$executeRawUnsafe(sqlScript);
  
  console.log("Dropping existing trigger if it exists...");
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS trg_calculate_lead_score ON "Lead";');

  console.log("Creating new trigger...");
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER trg_calculate_lead_score
    BEFORE INSERT OR UPDATE
    ON "Lead"
    FOR EACH ROW
    EXECUTE FUNCTION calculate_lead_score_trigger();
  `);
  console.log("Trigger successfully applied!");

  console.log("Recalculating scores for all existing leads (this might take a few seconds)...");
  // An update statement triggers the BEFORE UPDATE trigger on each row
  const updatedCount = await prisma.$executeRawUnsafe('UPDATE "Lead" SET "updatedAt" = NOW();');
  console.log(`Successfully recalculated scores for ${updatedCount} leads in the database!`);
}

main()
  .catch((e) => {
    console.error("Error executing script:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
