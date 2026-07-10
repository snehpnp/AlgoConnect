import { PrismaClient } from '@prisma/client';
import * as XLSX from '../../frontend/node_modules/xlsx';
import * as path from 'path';

const prisma = new PrismaClient();

const files = [
  '../../Investment Adviser as on Jul 03 2026.xls',
  '../../Registered Stock Brokers in Equity Derivative Segment as on Jul 03 2026.xls',
  '../../Research Analyst as on Jul 03 2026.xls'
];

async function main() {
  for (const file of files) {
    const filePath = path.join(__dirname, file);

    try {
      const wb = XLSX.readFile(filePath);
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];

      const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      let headerRowIndex = 0;
      for (let i = 0; i < Math.min(20, rawData.length); i++) {
        const row = rawData[i] || [];
        if (row.some(cell => typeof cell === 'string' && (cell.toLowerCase() === 'name' || cell.toLowerCase() === 'registration no.' || cell.toLowerCase() === 'email'))) {
          headerRowIndex = i;
          break;
        }
      }

      const headers = rawData[headerRowIndex] || [];
      const data = rawData.slice(headerRowIndex + 1).map(row => {
        const obj: any = {};
        headers.forEach((header, index) => {
          if (header && typeof header === 'string') {
            obj[header.trim()] = row[index];
          }
        });
        return obj;
      });

      const formattedLeads = data
        .map((row) => ({
          name: row.Name || row['Full Name'] || row.name || 'Unknown',
          email: row['Email-Id'] || row.Email || row['Email ID'] || row.email || null,
          phone: row.Telephone || row.Phone || row['Contact'] || row.phone || row['Phone Number'] ? String(row.Telephone || row.Phone || row['Contact'] || row.phone || row['Phone Number']) : null,
          registrationNo: row['Registration No.'] || null,
          contactPerson: row['Contact Person'] || null,
          address: row.Address || row['Correspondence Address'] || null,
          city: row.City || null,
          state: row.State || null,
          pincode: row.Pincode ? String(row.Pincode) : null,
          source: path.basename(file, '.xls')
        }))
        .filter(lead => lead.name !== 'Unknown' || lead.registrationNo);

      if (formattedLeads.length > 0) {

        const created = await prisma.lead.createMany({
          data: formattedLeads,
          skipDuplicates: true
        });

      }
    } catch (err) {
      console.error(`Error processing ${file}:`, err);
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
