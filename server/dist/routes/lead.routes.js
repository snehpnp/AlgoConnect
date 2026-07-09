"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const lead_controller_1 = require("../controllers/lead.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const uploadDir = path_1.default.join(process.cwd(), 'uploads');
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = (0, multer_1.default)({ storage });
const router = (0, express_1.Router)();
// All lead routes require a valid JWT token
router.get('/', auth_middleware_1.authenticate, lead_controller_1.getLeads);
router.post('/', auth_middleware_1.authenticate, lead_controller_1.createLead);
router.put('/:id', auth_middleware_1.authenticate, lead_controller_1.updateLead);
router.delete('/:id', auth_middleware_1.authenticate, lead_controller_1.deleteLead);
router.post('/import', auth_middleware_1.authenticate, lead_controller_1.importLeads);
// Chunked File Upload endpoints
const lead_controller_2 = require("../controllers/lead.controller");
router.get('/filters/options', auth_middleware_1.authenticate, lead_controller_2.getFilterOptions);
router.post('/upload-chunk', auth_middleware_1.authenticate, upload.single('chunk'), lead_controller_2.uploadChunk);
router.post('/process-file', auth_middleware_1.authenticate, lead_controller_2.processFile);
router.get('/:id/logs', auth_middleware_1.authenticate, lead_controller_1.getLeadLogs);
exports.default = router;
