import { Router } from 'express';
import { importLeads, getLeads } from '../controllers/lead.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// All lead routes requir