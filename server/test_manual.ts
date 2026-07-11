import prisma from './src/models/prismaClient';
import { getEmailTransporter, getEmailSenderId } from './src/utils/emailService';

async function test() {
  try {
    const lead = await prisma.lead.findFirst({ where: { email: { not: null } } });
    if (!lead) {
      console.log('No lead with email found');
      return;
    }
    
    console.log(`Sending to lead ${lead.id} with email ${lead.email}`);
    
    const transporter = await getEmailTransporter();
    const sender = await getEmailSenderId();
    
    const info = await transporter.sendMail({
      from: sender,
      to: lead.email,
      subject: 'Test Manual Message',
      html: '<p>This is a test message</p>'
    });
    
    console.log('Success:', info.messageId);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
