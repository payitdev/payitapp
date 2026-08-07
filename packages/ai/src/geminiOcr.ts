import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';

const PayrollItemSchema = z.object({
  recipientName: z.string().default(''),
  recipientAccountOrTag: z.string().default(''),
  amount: z.union([z.number(), z.string()]).transform(val => typeof val === 'number' ? val : parseFloat(val) || 0),
  confidence: z.number().optional().default(0.8),
});

const PayrollArraySchema = z.array(PayrollItemSchema);

export interface ExtractedPayrollItem {
  id: string;
  recipientName: string;
  recipientAccountOrTag: string;
  amount: number;
  confidenceScore: number;
}

export class GeminiOcrParser {
  private genAI: GoogleGenerativeAI;
  private modelName = 'gemini-1.5-flash-latest';

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required for payroll OCR');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Extracts payroll line items from a real uploaded file buffer using Gemini Flash Multimodal.
   * Accepts PDF, Excel (as base64), CSV text, or image files.
   * Returns structured, editable items for mandatory blocking review.
   * NEVER returns hardcoded or mock data.
   */
  public async extractPayrollFromFile(
    fileBuffer: Buffer,
    fileName: string
  ): Promise<ExtractedPayrollItem[]> {
    const model = this.genAI.getGenerativeModel({ model: this.modelName });

    const isTextFile =
      fileName.endsWith('.csv') ||
      fileName.endsWith('.txt') ||
      fileName.endsWith('.tsv');

    let prompt: string;
    let parts: any[];

    if (isTextFile) {
      // For CSV/text files, pass as plain text
      const textContent = fileBuffer.toString('utf-8');
      prompt = `You are a payroll parsing assistant for a financial platform called PayIT.
Extract ALL payroll line items from the following payroll document.

RULES:
- Return ONLY a valid JSON array. No explanation, no markdown, no code fences.
- Each item must have: recipientName (string), recipientAccountOrTag (string — could be bank account number, tag like @handle, or NUBAN), amount (number — in local currency without symbols or commas), confidence (number between 0 and 1).
- If a field is unclear, make your best attempt and set confidence below 0.85.
- Do NOT invent data. Only extract what is actually present in the document.
- If the document has no payroll data, return an empty array: []

DOCUMENT:
${textContent}`;

      parts = [{ text: prompt }];
    } else {
      // For PDF, Excel screenshots, or image scans — use multimodal
      const base64Data = fileBuffer.toString('base64');
      const mimeType = fileName.endsWith('.pdf')
        ? 'application/pdf'
        : fileName.endsWith('.png')
        ? 'image/png'
        : 'image/jpeg';

      prompt = `You are a payroll parsing assistant for a financial platform called PayIT.
Extract ALL payroll line items from this payroll document image/PDF.

RULES:
- Return ONLY a valid JSON array. No explanation, no markdown, no code fences.
- Each item must have: recipientName (string), recipientAccountOrTag (string — bank account number, PayIT @handle, or NUBAN), amount (number — numeric only, no currency symbol), confidence (number between 0 and 1).
- If a field is unclear, make your best attempt and set confidence below 0.85.
- Do NOT invent data. Only extract what is visible in the document.
- If the document has no payroll data, return an empty array: []`;

      parts = [
        { text: prompt },
        {
          inlineData: {
            mimeType,
            data: base64Data,
          },
        },
      ];
    }

    const result = await model.generateContent(parts);
    const rawText = result.response.text().trim();

    // Strip any accidental markdown code fences Gemini might add
    const cleaned = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    let rawJson: unknown;
    try {
      rawJson = JSON.parse(cleaned);
    } catch (e) {
      throw new Error(`Gemini OCR returned unparseable response for file "${fileName}": ${rawText.slice(0, 200)}`);
    }

    const validationResult = PayrollArraySchema.safeParse(rawJson);
    if (!validationResult.success) {
      throw new Error(`Gemini OCR returned invalid schema format for file "${fileName}": ${validationResult.error.message}`);
    }

    return validationResult.data.map((item, idx) => ({
      id: `item_${idx + 1}_${Date.now()}`,
      recipientName: item.recipientName.trim(),
      recipientAccountOrTag: item.recipientAccountOrTag.trim(),
      amount: item.amount,
      confidenceScore: item.confidence,
    }));
  }
}
