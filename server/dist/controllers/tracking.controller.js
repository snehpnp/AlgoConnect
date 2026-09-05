"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackLinkClick = exports.trackEmailOpen = void 0;
const email_tracking_service_1 = require("../services/email-tracking.service");
const emailTrackingService = new email_tracking_service_1.EmailTrackingService();
// A 1x1 transparent PNG buffer
const trackingPixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==', 'base64');
const trackEmailOpen = async (req, res) => {
    try {
        const { messageId } = req.params;
        // Asynchronously process the open event so we don't block serving the image
        emailTrackingService.processProviderWebhook(messageId, 'OPENED', { source: 'custom_pixel' })
            .catch(err => console.error('[Tracking Pixel] Error processing open event:', err));
    }
    catch (error) {
        console.error('[Tracking Pixel] Error:', error);
    }
    finally {
        // Always return the 1x1 image so the email client is happy
        res.set({
            'Content-Type': 'image/png',
            'Content-Length': trackingPixel.length.toString(),
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
        });
        res.end(trackingPixel);
    }
};
exports.trackEmailOpen = trackEmailOpen;
const trackLinkClick = async (req, res) => {
    try {
        const trackingId = req.params.trackingId;
        const reqInfo = {
            ip: req.ip || req.socket.remoteAddress,
            device: Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'],
            browser: Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'],
            country: 'Unknown' // Ideally from geo-ip lookup
        };
        const originalUrl = await emailTrackingService.trackLinkClick(trackingId, reqInfo);
        if (originalUrl) {
            return res.redirect(302, originalUrl);
        }
        else {
            // If tracking ID not found, just redirect to home or a safe fallback
            return res.redirect(302, process.env.FRONTEND_URL || 'http://localhost:5173');
        }
    }
    catch (error) {
        console.error('[Tracking Link] Error:', error);
        return res.redirect(302, process.env.FRONTEND_URL || 'http://localhost:5173');
    }
};
exports.trackLinkClick = trackLinkClick;
