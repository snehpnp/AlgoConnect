"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const lead_routes_1 = __importDefault(require("./routes/lead.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const dashboard_routes_1 = __importDefault(require("./routes/dashboard.routes"));
const campaign_routes_1 = __importDefault(require("./routes/campaign.routes"));
const segment_routes_1 = __importDefault(require("./routes/segment.routes"));
const consent_routes_1 = __importDefault(require("./routes/consent.routes"));
const settings_routes_1 = __importDefault(require("./routes/settings.routes"));
const automation_routes_1 = __importDefault(require("./routes/automation.routes"));
const template_routes_1 = __importDefault(require("./routes/template.routes"));
const chat_routes_1 = __importDefault(require("./routes/chat.routes"));
const webhook_routes_1 = __importDefault(require("./routes/webhook.routes"));
const message_routes_1 = __importDefault(require("./routes/message.routes"));
const tracking_routes_1 = __importDefault(require("./routes/tracking.routes"));
const ai_routes_1 = __importDefault(require("./routes/ai.routes"));
const notification_routes_1 = __importDefault(require("./routes/notification.routes"));
const notes_routes_1 = __importDefault(require("./routes/notes.routes"));
const audit_routes_1 = __importDefault(require("./routes/audit.routes"));
const upload_routes_1 = __importDefault(require("./routes/upload.routes"));
const path_1 = __importDefault(require("path"));
const app = (0, express_1.default)();
const httpServer = http_1.default.createServer(app);
const port = process.env.PORT || 7700;
// Middleware
app.use((0, cors_1.default)({ origin: true, credentials: true }));
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ limit: '50mb', extended: true }));
// Serve uploads as static
app.use('/uploads', express_1.default.static(path_1.default.join(process.cwd(), 'uploads')));
// Routes
app.use('/api/auth', auth_routes_1.default);
app.use('/api/leads', lead_routes_1.default);
app.use('/api/users', user_routes_1.default);
app.use('/api/dashboard', dashboard_routes_1.default);
app.use('/api/campaigns', campaign_routes_1.default);
app.use('/api/segments', segment_routes_1.default);
app.use('/api/consents', consent_routes_1.default);
app.use('/api/settings', settings_routes_1.default);
app.use('/api/automations', automation_routes_1.default);
app.use('/api/templates', template_routes_1.default);
app.use('/api/chat', chat_routes_1.default);
app.use('/api/messages', message_routes_1.default);
app.use('/api/webhooks', webhook_routes_1.default);
app.use('/api/track', tracking_routes_1.default);
app.use('/api/ai', ai_routes_1.default);
app.use('/api/notifications', notification_routes_1.default);
app.use('/api/upload', upload_routes_1.default);
app.use('/api', notes_routes_1.default); // notes, follow-ups, csv export
app.use('/api/audit-logs', audit_routes_1.default);
// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'AlgoConnect Server is running' });
});
// 404 Handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});
const errorHandler_1 = require("./middlewares/errorHandler");
app.use(errorHandler_1.errorHandler);
const campaignRunner_service_1 = require("./services/campaignRunner.service");
const socket_service_1 = require("./services/socket.service");
// Initialize Socket.io
socket_service_1.SocketService.initialize(httpServer);
(0, campaignRunner_service_1.startCampaignRunner)();
// Poll for email replies every 5 minutes (Disabled legacy listener, using new IMAP engine in campaignRunner)
// cron.schedule('*/5 * * * *', () => {
//   pollImapForReplies();
// });
httpServer.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
