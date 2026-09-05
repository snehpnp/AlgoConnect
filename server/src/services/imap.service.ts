import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const checkIMAPReplies = async () => {
  console.log('[IMAP] Starting IMAP reply check...');
  try {
    const imapSetting = await (prisma as any).integrationSetting.findUnique({
      where: { type: 'EMAIL' }, // Use the existing EMAIL settings
    });

    if (!imapSetting || !imapSetting.isActive || !imapSetting.host || !imapSetting.apiKey || !imapSetting.apiSecret) {
      console.log('[IMAP] IMAP (EMAIL) is not configured or is inactive.');
      return;
    }

    // Auto-convert smtp.gmail.com to imap.gmail.com
    let imapHost = imapSetting.host;
    if (imapHost.toLowerCase().startsWith('smtp.')) {
      imapHost = imapHost.toLowerCase().replace('smtp.', 'imap.');
    }

    const config = {
      imap: {
        user: imapSetting.apiKey,
        password: imapSetting.apiSecret,
        host: imapHost,
        port: 993, // Default IMAP secure port
        tls: true, // IMAP almost always requires TLS on 993
        authTimeout: 10000,
        tlsOptions: { rejectUnauthorized: false }
      },
    };

    const connection = await imaps.connect(config);
    await connection.openBox('INBOX');

    // Search for UNSEEN emails
    const searchCriteria = ['UNSEEN'];
    const fetchOptions = {
      bodies: ['HEADER', 'TEXT', ''],
      markSeen: true,
      struct: true,
    };

    const messages = await connection.search(searchCriteria, fetchOptions);
    console.log(`[IMAP] Found ${messages.length} unseen messages.`);

    for (const item of messages) {
      const all = item.parts.find((part: any) => part.which === '');
      const id = item.attributes.uid;
      const idHeader = 'Imap-Id: ' + id + '\r\n';
      
      if (!all) continue;
      
      try {
        const mail = await simpleParser(idHeader + all.body);
        
        if (!mail.from || !mail.from.value || mail.from.value.length === 0) continue;
        
        const senderEmail = mail.from.value[0].address;
        if (!senderEmail) continue;

        console.log(`[IMAP] Processing email from: ${senderEmail}`);

        // --- CHECK FOR BOUNCE ---
        const senderLower = senderEmail.toLowerCase();
        const subjectLower = (mail.subject || '').toLowerCase();
        
        const isBounce = senderLower.includes('mailer-daemon') || 
                         senderLower.includes('postmaster') ||
                         subjectLower.includes('delivery status notification') ||
                         subjectLower.includes('undelivered mail');

        if (isBounce) {
          console.log(`[IMAP] Detected bounce email.`);
          const textContent = mail.text || '';
          const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
          const matchedEmails = textContent.match(emailRegex) || [];
          
          const failedEmails = matchedEmails.map(e => e.toLowerCase()).filter(e => 
            !e.includes('mailer-daemon') && !e.includes('postmaster')
          );

          if (failedEmails.length > 0) {
            // Usually the first non-system email is the bounced recipient
            const bouncedEmail = failedEmails[0];
            console.log(`[IMAP] Found bounced recipient: ${bouncedEmail}`);
            
            const lead = await prisma.lead.findFirst({
              where: {
                OR: [
                  { email: { equals: bouncedEmail, mode: 'insensitive' } },
                  { email2: { equals: bouncedEmail, mode: 'insensitive' } }
                ]
              }
            });

            if (lead) {
              const lastSend = await prisma.messageSend.findFirst({
                where: { leadId: lead.id, channel: 'EMAIL' },
                orderBy: { createdAt: 'desc' }
              });

              if (lastSend) {
                await prisma.messageSend.update({
                  where: { id: lastSend.id },
                  data: {
                    status: 'BOUNCED',
                    bouncedAt: new Date()
                  }
                });

                await prisma.engagementEvent.create({
                  data: {
                    messageSendId: lastSend.id,
                    eventType: 'BOUNCED',
                    metadataJson: {
                      subject: mail.subject,
                      error: 'Address not found / Delivery Failed'
                    }
                  }
                });

                await prisma.lead.update({
                  where: { id: lead.id },
                  data: { engagementStatus: 'Bounced' }
                });
                console.log(`[IMAP] Successfully logged BOUNCE for Lead ID: ${lead.id}`);
              }
            }
          }
          continue; // Skip the regular reply logic for bounce emails
        }
        // --- END BOUNCE CHECK ---

        // Try to find a lead with this email for a regular reply
        const lead = await prisma.lead.findFirst({
          where: {
            OR: [
              { email: { equals: senderEmail, mode: 'insensitive' } },
              { email2: { equals: senderEmail, mode: 'insensitive' } },
            ]
          }
        });

        if (lead) {
          console.log(`[IMAP] Matched email to Lead ID: ${lead.id}`);
          
          // Find the most recent MessageSend for this lead
          const lastSend = await prisma.messageSend.findFirst({
            where: { leadId: lead.id, channel: 'EMAIL' },
            orderBy: { createdAt: 'desc' }
          });

          if (lastSend) {
            console.log(`[IMAP] Logging reply for MessageSend ID: ${lastSend.id}`);
            
            // Log the reply
            await prisma.emailReply.create({
              data: {
                messageSendId: lastSend.id,
                leadId: lead.id,
                fromEmail: senderEmail,
                subject: mail.subject || 'No Subject',
                body: mail.text || 'No Body',
                providerMessageId: mail.messageId || `imap-${id}-${Date.now()}`
              }
            });

            // Update MessageSend status
            await prisma.messageSend.update({
              where: { id: lastSend.id },
              data: { 
                status: 'REPLIED',
                repliedAt: new Date()
              }
            });

            // Create Engagement Event for the reply
            await prisma.engagementEvent.create({
              data: {
                messageSendId: lastSend.id,
                eventType: 'REPLIED',
                metadataJson: {
                  subject: mail.subject || 'No Subject',
                  body: mail.text || 'No Body'
                }
              }
            });

            // Update Lead Engagement Status
            await prisma.lead.update({
              where: { id: lead.id },
              data: { engagementStatus: 'Replied' }
            });

            console.log(`[IMAP] Successfully updated CRM for Lead ID: ${lead.id}`);
          } else {
             console.log(`[IMAP] Lead found but no previous MessageSend found.`);
          }
        }
      } catch (err) {
        console.error(`[IMAP] Error processing message UID ${id}:`, err);
      }
    }

    connection.end();
    console.log('[IMAP] IMAP reply check completed.');
  } catch (error) {
    console.error('[IMAP] Error connecting or checking IMAP:', error);
  }
};
