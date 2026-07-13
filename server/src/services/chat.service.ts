import * as dotenv from 'dotenv';
dotenv.config();
import Groq from 'groq-sdk';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class ChatService {
  private groq: Groq | null = null;

  constructor() {
    if (process.env.GROQ_API_KEY) {
      this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    } else {
      console.warn('GROQ_API_KEY is not defined in environment variables.');
    }
  }

  async processQuery(userMessage: string): Promise<string> {
    if (!this.groq) {
      return 'I am currently unavailable because the AI service is not configured.';
    }

    try {
      // Step 1: Generate SQL from natural language
      const sqlQuery = await this.generateSQL(userMessage);
      console.log(`[ChatService] Generated SQL: ${sqlQuery}`);

      if (sqlQuery === 'INVALID') {
        return "I can only answer questions related to your AlgoConnect database (Leads, Campaigns, etc.). How can I help you with that?";
      }

      if (!sqlQuery.trim().toUpperCase().startsWith('SELECT')) {
        return "For security reasons, I can only perform read-only queries. I cannot modify or delete data.";
      }

      // Step 2: Execute the SQL securely
      let dbResult;
      try {
        dbResult = await prisma.$queryRawUnsafe(sqlQuery);
      } catch (dbError: any) {
        console.error(`[ChatService] Database error executing generated SQL: ${dbError.message}`);
        return await this.generateResponse(userMessage, { error: 'The generated database query failed to execute.', details: dbError.message });
      }

      // Step 3: Generate a friendly response based on the data
      const finalResponse = await this.generateResponse(userMessage, dbResult);
      return finalResponse;

    } catch (error: any) {
      console.error(`[ChatService] Error in processQuery: ${error.message}`);
      return 'Sorry, I encountered an unexpected error while processing your request.';
    }
  }

  private async generateSQL(userMessage: string): Promise<string> {
    const schemaDetails = `
You are an expert PostgreSQL database administrator for a CRM called AlgoConnect.
Your task is to translate the user's natural language question into a valid, executable PostgreSQL SELECT statement.

Below is the simplified schema of the database:
Table "Lead" (
  id INT,
  name VARCHAR,
  email VARCHAR,
  phone VARCHAR,
  type VARCHAR,
  "salesStage" VARCHAR,
  city VARCHAR,
  state VARCHAR,
  "leadScore" INT,
  website VARCHAR,
  "hasOwnWebsite" BOOLEAN,
  "isEnriched" BOOLEAN
)
Table "Campaign" (
  id INT,
  name VARCHAR,
  type VARCHAR,
  status VARCHAR
)

Rules:
1. Return ONLY the raw SQL query. No markdown, no backticks, no explanations.
2. The query MUST begin with the word SELECT. Do NOT use INSERT, UPDATE, DELETE, DROP, or ALTER.
3. Always quote table and column names using double quotes (e.g., "Lead", "leadScore", "hasOwnWebsite") if they contain mixed case or match reserved keywords. For example: SELECT COUNT(*) FROM "Lead" WHERE "hasOwnWebsite" = true;
4. Ensure all string comparisons are case-insensitive or use ILIKE.
5. If the user asks something completely unrelated to the database or impossible to query, output the exact word: INVALID
`;

    const response = await this.groq!.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: schemaDetails },
        { role: 'user', content: userMessage }
      ],
      temperature: 0,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content || '';
    return content.replace(/```sql/ig, '').replace(/```/g, '').trim();
  }

  private async generateResponse(userMessage: string, dbData: any): Promise<string> {
    // Prevent huge payloads if the query returns thousands of rows
    let dataString = '';
    // BigInt serialization fix
    const replacer = (key: string, value: any) => (typeof value === 'bigint' ? value.toString() : value);

    if (Array.isArray(dbData)) {
      if (dbData.length > 50) {
        dataString = JSON.stringify(dbData.slice(0, 50), replacer) + `\n...(and ${dbData.length - 50} more records)`;
      } else {
        dataString = JSON.stringify(dbData, replacer);
      }
    } else {
      dataString = JSON.stringify(dbData, replacer);
    }

    const prompt = `
You are an intelligent and friendly CRM assistant for AlgoConnect.
The user asked: "${userMessage}"

To answer this, I queried the database and got the following raw data:
${dataString}

Your task:
Write a clear, concise, and helpful response to the user's question using ONLY the data provided. 
- Do NOT show the raw JSON or the SQL query to the user.
- If the data is empty or indicates an error, kindly explain that no records were found or there was an issue retrieving the data.
- Format the response beautifully using markdown (bullet points, bold text, etc.) if there are multiple records.
`;

    const response = await this.groq!.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
    });

    return response.choices[0]?.message?.content || 'I could not generate a response.';
  }
}

export const chatService = new ChatService();
