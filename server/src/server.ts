import express from 'express';
import cors from 'cors';
import http from 'http';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.routes';
import leadRoutes from './routes/lead.routes';
import userRoutes from './routes/user.routes';
import dashboardRoutes from './routes/dashboard.routes';
import campaignRoutes from './routes/campaign.routes';
import segmentRoutes from './routes/segment.routes';
import consentRoutes from './routes/consent.routes';
import settingsRoutes from './routes/settings.routes';
import automationRoutes from './routes/automation.routes';
import templateRoutes from './routes/template.routes';
import chatRoutes from './routes/chat.routes';
import webhookRoutes from './routes/webhook.routes';
import messageRoutes from './routes/message.routes';
import trackingRoutes from './routes/tracking.routes';
import aiRoutes from './routes/ai.routes';
import notificationRoutes from './routes/notification.routes';

const app = express();
const httpServer = http.createServer(app);
const port = process.env.PORT || 7700;

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/segments', segmentRoutes);
app.use('/api/consents', consentRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/automations', automationRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/track', trackingRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'AlgoConnect Server is running' });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

import { errorHandler } from './middlewares/errorHandler';
app.use(errorHandler);

import { startCampaignRunner } from './services/campaignRunner.service';
import { pollImapForReplies } from './services/imapListener.service';
import { SocketService } from './services/socket.service';
import cron from 'node-cron';

// Initialize Socket.io
SocketService.initialize(httpServer);

startCampaignRunner();

// Poll for email replies every 5 minutes (Disabled legacy listener, using new IMAP engine in campaignRunner)
// cron.schedule('*/5 * * * *', () => {
//   pollImapForReplies();
// });

httpServer.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
