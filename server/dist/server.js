"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
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
const app = (0, express_1.default)();
const port = process.env.PORT || 7700;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ limit: '50mb', extended: true }));
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
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
