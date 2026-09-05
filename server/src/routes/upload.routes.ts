import { Router } from 'express';
import { upload, handleFileUpload } from '../controllers/upload.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/', upload.single('file'), handleFileUpload);

export default router;
