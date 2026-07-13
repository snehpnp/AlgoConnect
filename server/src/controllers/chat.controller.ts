import { Request, Response } from 'express';
import { chatService } from '../services/chat.service';

export const handleChat = async (req: Request, res: Response): Promise<void> => {
  try {
    const { message } = req.body;

    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    const response = await chatService.processQuery(message);
    res.status(200).json({ response });
  } catch (error: any) {
    console.error(`[ChatController] Error: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
};
