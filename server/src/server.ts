import express from 'express';
import cors from 'cors';
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

const app = express();
const port = process.env.PORT || 7700;

// Middleware
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
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
startCampaignRunner();

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
