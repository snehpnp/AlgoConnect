import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import * as path from 'path';

const prisma = new PrismaClient();

const files = [
  '../../Investment Adviser as on Jul 03 2026.xls',
  '../../Registered Stock Brokers in Equity Derivative Segment as on Jul 03 2026.xls',
  '../../Research Analyst as on Jul 03 2026.xls'
];

async function runImport() {
  let totalImported = 0;

  console.log('Clearing old leads...');
  await prisma.lead.deleteMany({});
  console.log('Old leads cleared successfully.');

  for (const file of files) {
    const filePath = path.resolve(__dirname, file);
    console.log(`\nProcessing file: ${path.basename(filePath)}`);
    
    try {
      const wb = XLSX.readFile(filePath);
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      
      let headerRowIndex = 0;
      // Search first 20 rows to find actual header row
      for (let i = 0; i < Math.min(20, rawData.length); i++) {
        const row = rawData[i] || [];
        if (row.some(cell => typeof cell === 'string' && (cell.toLowerCase() === 'name' || cell.toLowerCase() === 'registration no.' || cell.toLowerCase() === 'email'))) {
          headerRowIndex = i;
          break;
        }
      }

      const headerCounts: Record<string, number> = {};
      const headers = (rawData[headerRowIndex] || []).map((header: any) => {
        if (!header || typeof header !== 'string') return '';
        const trimmed = header.trim();
        headerCounts[trimmed] = (headerCounts[trimmed] || 0) + 1;
        return headerCounts[trimmed] > 1 ? `${trimmed}_${headerCounts[trimmed]}` : trimmed;
      });

      const data = rawData.slice(headerRowIndex + 1).map(row => {
        const obj: any = {};
        headers.forEach((header, index) => {
          if (header) {
            obj[header] = row[index];
          }
        });
        return obj;
      });

      let leadType = 'Manual';
      if (file.includes('Investment Adviser')) leadType = 'IA';
      else if (file.includes('Registered Stock Brokers')) leadType = 'Sub Broker';
      else if (file.includes('Research Analyst')) leadType = 'RA';

      const formattedLeads = data
        .map((row) => ({
          name: row.Name || row['Full Name'] || row.name || 'Unknown',
          email: row['Email-Id'] || row.Email || row['Email ID'] || row.email || null,
          email2: row['Email-Id_2'] || row.Email_2 || row['Email ID_2'] || row.email_2 || null,
          phone: row.Telephone || row.Phone || row['Contact'] || row.phone || row['Phone Number'] ? String(row.Telephone || row.Phone || row['Contact'] || row.phone || row['Phone Number']) : null,
          phone2: row.Telephone_2 || row.Phone_2 || row['Contact_2'] || row.phone_2 || row['Phone Number_2'] ? String(row.Telephone_2 || row.Phone_2 || row['Contact_2'] || row.phone_2 || row['Phone Number_2']) : null,
          registrationNo: row['Registration No.'] || null,
          contactPerson: row['Contact Person'] || null,
          address: row.Address || row['Correspondence Address'] || null,
          city: row.City || null,
          state: row.State || null,
          pincode: row.Pincode || null,
          source: 'SEBI Sheet Automated Import',
          type: leadType
        }))
        .filter(lead => lead.name !== 'Unknown' || lead.registrationNo);

      if (formattedLeads.length > 0) {
        // Insert into DB
        const result = await prisma.lead.createMany({
          data: formattedLeads,
          skipDuplicates: true
        });
        console.log(`Successfully imported ${result.count} leads from this sheet.`);
        totalImported += result.count;
      } else {
        console.log(`No valid leads found in this sheet.`);
      }
    } catch (err: any) {
      console.error(`Error processing file ${file}:`, err.message);
    }
  }

  console.log(`\nImport complete! Total leads inserted into the database: ${totalImported}`);
  await prisma.$disconnect();
}

runImport().catch(async (e) => {
  console.error('Fatal error during import:', e);
  await prisma.$disconnect();
  process.exit(1);
});
