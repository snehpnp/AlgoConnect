import { Request, Response } from 'express';
import { EmailTrackingService } from '../services/email-tracking.service';

const emailTrackingService = new EmailTrackingService();

// A 1x1 transparent PNG buffer
const trackingPixel = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==',
  'base64'
);

export const trackEmailOpen = async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    
    // Asynchronously process the open event so we don't block serving the image
    emailTrackingService.processProviderWebhook(messageId as string, 'OPENED', { source: 'custom_pixel' })
      .catch(err => console.error('[Tracking Pixel] Error processing open event:', err));

  } catch (error) {
    console.error('[Tracking Pixel] Error:', error);
  } finally {
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
