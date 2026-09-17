import * as imap from 'imap-simple';
import { simpleParser } from 'mailparser';
import prisma from '../models/prismaClient';

export const pollImapForReplies = async () => {
  try {
    const setting = await (prisma as any).integrationSetting.findUnique({
      where: { type: 'EMAIL' },
    });

    if (!setting || !setting.host || !setting.apiKey || !setting.apiSecret) {
      console.log('[' + new Date().toISOString() + '] -', '[IMAP Listener] Email service not configured.');
      return;
    }

    // Attempt to guess IMAP host if they provided SMTP (e.g., smtp.gmail.com -> imap.gmail.com)
    let imapHost = setting.host;
    if (imapHost.startsWith('smtp.')) {
      imapHost = imapHost.replace('smtp.', 'imap.');
    }

    const config = {
      imap: {
        user: setting.apiKey,
        password: setting.apiSecret,
        host: imapHost,
        port: 993, // Standard IMAP SSL port
        tls: true,
        authTimeout: 10000,
        tlsOptions: { rejectUnauthorized: false }
      }
    };

    const connection = await imap.connect(config);
    await connection.openBox('INBOX');

    // Fetch unseen messages
    const searchCriteria = ['UNSEEN'];
    const fetchOptions = { bodies: ['HEADER', 'TEXT'], struct: true };

    const messages = await connection.search(searchCriteria, fetchOptions);
    
    for (const msg of messages) {
      const allParts = imap.getParts(msg.attributes.struct as any);
      let bodyData = '';
      
      const parts = msg.parts || [];
      for (const part of parts) {
        if (part.which === 'TEXT') {
          bodyData = part.body;
        } else if (part.which !== 'HEADER') {
          bodyData = part.body;
        }
      }

      const headerPart = parts.find(p => p.which === 'HEADER');
      const headerStr = headerPart ? headerPart.body : '';
      
      const parsed = await simpleParser(headerStr + '\r\n\r\n' + bodyData);
      const fromAddress = parsed.from?.value[0]?.address?.toLowerCase() || '';

      // Check if it's a bounce report
      if (fromAddress.includes('mailer-daemon') || fromAddress.includes('postmaster') || parsed.subject?.toLowerCase().includes('delivery status') || parsed.subject?.toLowerCase().includes('undeliverable') || parsed.subject?.toLowerCase().includes('failure')) {
        const bodyText = parsed.text || '';
        // Try to find the original message ID in the bounce text
        const match = bodyText.match(/(auto_email_\d+)/);
        if (match) {
          const providerMessageId = match[1];
          const messageSend = await prisma.messageSend.findFirst({
            where: { providerMessageId: providerMessageId }
          });
          if (messageSend && messageSend.status !== 'BOUNCED') {
            let failureReason = 'Unknown Bounce';
            const textLower = bodyText.toLowerCase();
            
            // Extract exact SMTP error code (like 550, 5.1.1, etc.) to provide exact reason
            const errorMatch = bodyText.match(/((?:55\d|45\d|5\.\d\.\d|4\.\d\.\d)\s+[^\r\n]+|Diagnostic-Code:\s*smtp;[^\r\n]+)/i);
            const exactDetail = errorMatch ? ` | Detail: ${errorMatch[0].replace(/Diagnostic-Code:\s*smtp;\s*/i, '').substring(0, 150)}` : '';

            if (textLower.match(/address not found|user unknown|no such user|invalid address|not exist|bad address|recipient rejected/)) {
              failureReason = 'Hard Bounce - Address Not Found';
            } else if (textLower.match(/mailbox full|quota exceeded|over quota/)) {
              failureReason = 'Soft Bounce - Mailbox Full';
            } else if (textLower.match(/blocked|spam|rejected|blacklisted|policy|dmarc|spf/)) {
              failureReason = 'Blocked - Spam or Policy Rejection';
            } else if (textLower.match(/domain not found|dns/)) {
              failureReason = 'Hard Bounce - Domain/DNS Error';
            } else if (textLower.match(/relay access denied|relaying denied/)) {
              failureReason = 'Hard Bounce - Relay Denied';
            } else if (textLower.match(/timeout|try again later|temporarily deferred/)) {
              failureReason = 'Soft Bounce - Timeout/Temporary';
            }

            failureReason = failureReason + exactDetail;

            await prisma.engagementEvent.create({
              data: {
                messageSendId: messageSend.id,
                eventType: 'BOUNCED',
                metadataJson: { error: failureReason }
              }
            });
            await prisma.messageSend.update({
              where: { id: messageSend.id },
              data: { status: 'BOUNCED', bouncedAt: new Date(), failureReason: failureReason }
            });
            console.log('[' + new Date().toISOString() + '] -', `[IMAP Listener] Processed bounce for message ${providerMessageId}`);
          }
        }
      } else {
        // Look for In-Reply-To or References
        let replyToId = parsed.inReplyTo || (parsed.references && parsed.references[0]);
        
        if (replyToId) {
        // Strip < > if present
        replyToId = replyToId.replace(/^<|>$/g, '');
        
        // Remove the domain part to get our providerMessageId
        const providerMessageId = replyToId.split('@')[0];
        
        const messageSend = await prisma.messageSend.findFirst({
          where: { providerMessageId: providerMessageId }
        });

        if (messageSend) {
          // Check if reply already exists to avoid duplicates
          const existingReply = await prisma.emailReply.findFirst({
            where: { messageSendId: messageSend.id, fromEmail: parsed.from?.value[0]?.address || '' }
          });

          if (!existingReply) {
            const emailReply = await prisma.emailReply.create({
              data: {
                messageSendId: messageSend.id,
                leadId: messageSend.leadId,
                fromEmail: parsed.from?.value[0]?.address || 'unknown',
                subject: parsed.subject || '',
                body: parsed.text || parsed.html || 'No content',
                receivedAt: parsed.date || new Date(),
                providerMessageId: parsed.messageId
              }
            });

            await prisma.engagementEvent.create({
              data: {
                messageSendId: messageSend.id,
                eventType: 'REPLY',
                metadataJson: { replyId: emailReply.id }
              }
            });

            await prisma.messageSend.update({
              where: { id: messageSend.id },
              data: { status: 'REPLIED', repliedAt: new Date() }
            });
            
            console.log('[' + new Date().toISOString() + '] -', `[IMAP Listener] Processed reply for message ${providerMessageId}`);
          }
        }
      }
      }

      // Mark message as seen
      await connection.addFlags(msg.attributes.uid, ['\\Seen']);
    }

    connection.end();
  } catch (error) {
    console.log('[' + new Date().toISOString() + '] -', '[IMAP Listener] Error:', error);
  }
};
