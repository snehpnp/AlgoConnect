import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import Groq from 'groq-sdk';

export const generateTemplate = asyncHandler(async (req: Request, res: Response) => {
  const { topic, channelType } = req.body;

  if (!topic) {
    throw Object.assign(new Error('Please provide a topic'), { statusCode: 400 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error('Groq API Key is not configured'), { statusCode: 500 });
  }

  const groq = new Groq({ apiKey });

  let systemPrompt = '';
  if (channelType === 'EMAIL') {
    systemPrompt = `You are an expert copywriter. Generate a professional email template based on the user's topic. 
You must respond with ONLY a valid JSON object in the exact following format:
{
  "subject": "The email subject",
  "content": "The HTML content of the email"
}
Ensure the content is well-formatted HTML suitable for an email body. Do not include markdown formatting like \`\`\`json.`;
  } else {
    systemPrompt = `You are an expert copywriter. Generate a professional ${channelType} message template based on the user's topic. 
You must respond with ONLY a valid JSON object in the exact following format:
{
  "subject": "Short summary or subject (optional, can be empty)",
  "content": "The text content of the message"
}
Do not use HTML for SMS/WhatsApp, use plain text. Do not include markdown formatting like \`\`\`json.`;
  }

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Topic: ${topic}` }
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });

    const responseText = chatCompletion.choices[0]?.message?.content || '{}';
    const parsedData = JSON.parse(responseText);

    res.status(200).json({
      success: true,
      data: parsedData
    });
  } catch (error: any) {
    console.error('Groq API Error:', error);
    throw Object.assign(new Error('Failed to generate template from AI: ' + error.message), { statusCode: 500 });
  }
});
