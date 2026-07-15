"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleEmailWebhook = void 0;
const email_tracking_service_1 = require("../services/email-tracking.service");
const handleEmailWebhook = async (req, res) => {
    try {
        // 1. In a real system, verify the webhook signature here based on ESP (e.g. SendGrid, SES)
        // const signature = req.headers['x-provider-signature'];
        // verifySignature(signature, req.rawBody);
        console.log("Enter")
        const events = Array.isArray(req.body) ? req.body : [req.body];
        for (const event of events) {
            // Map ESP specific event structure to our internal eventType
            // This is pseudo-code for a generic ESP. 
            // e.g. SendGrid sends { event: 'delivered', sg_message_id: '...' }
            const providerMessageId = event.provider_message_id || event.sg_message_id || event.MessageId;
            const rawType = (event.event || event.eventType || '').toUpperCase();
            let eventType = null;
            if (rawType.includes('DELIVER'))
                eventType = 'DELIVERED';
            else if (rawType.includes('OPEN'))
                eventType = 'OPENED';
            else if (rawType.includes('CLICK'))
                eventType = 'CLICKED';
            else if (rawType.includes('BOUNCE'))
                eventType = 'BOUNCED';
            else if (rawType.includes('SPAM'))
                eventType = 'SPAM';
            else if (rawType.includes('UNSUBSCRIBE'))
                eventType = 'UNSUBSCRIBED';
            else if (rawType.includes('REPLY'))
                eventType = 'REPLIED';
            else if (rawType.includes('FAIL') || rawType.includes('DROP'))
                eventType = 'FAILED';
            if (!providerMessageId || !eventType) {
                console.warn('Webhook received unmappable event', event);
                continue; // Skip unrecognized events
            }
            await email_tracking_service_1.emailTrackingService.processProviderWebhook(providerMessageId, eventType, event, { ip: event.ip, useragent: event.useragent, url: event.url });
        }
        res.status(200).json({ received: true });
    }
    catch (error) {
        console.error('Webhook processing error:', error);
        // Don't leak details, return 200 to prevent provider from indefinitely retrying if it's our logic error,
        // OR return 500 if we want them to retry (e.g. DB is temporarily down).
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
exports.handleEmailWebhook = handleEmailWebhook;
