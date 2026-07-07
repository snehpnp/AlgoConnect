import { Router } from 'express';
import { importLeads, getLeads, createLead, updateLead, deleteLead, getLeadLogs } from '../controllers/lead.controller';
import { authenticate } from '../middlewares/auth.middleware';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, file.originalname)
});

const upload = multer({ storage });

const router = Router();

// All lead routes require a valid JWT token
router.get('/', authenticate, getLeads);
router.post('/', authenticate, createLead);
router.put('/:id', authenticate, updateLead);
router.delete('/:id', authenticate, deleteLead);
router.post('/import', authenticate, importLeads);

// Chunked File Upload endpoints
import { uploadChunk, processFile, getFilterOptions } from '../controllers/lead.controller';
router.get('/filters/options', authenticate, getFilterOptions);
router.post('/upload-chunk', authenticate, upload.single('chunk'), uploadChunk);
router.post('/process-file', authenticate, processFile);

router.get('/:id/logs', authenticate, getLeadLogs);

export default router;
