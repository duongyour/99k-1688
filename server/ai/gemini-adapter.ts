import { AIProvider, AIGenerateOptions, AIHealthStatus } from './provider-interface.ts';
import { GoogleGenAI } from '@google/genai';

export class GeminiProvider implements AIProvider {
  public readonly id = 'provider_gemini';
  public readonly displayName = 'Google Gemini';
  public readonly providerType = 'gemini';
  private aiClient: GoogleGenAI | null = null;

  constructor() {
    const key = process.env.GEMINI_API_KEY;
    if (key) {
      this.aiClient = new GoogleGenAI({ apiKey: key });
    }
  }

  private getClient(): GoogleGenAI {
    if (!this.aiClient) {
      const key = process.env.GEMINI_API_KEY;
      if (!key) {
        throw new Error('GEMINI_API_KEY chưa được cấu hình trong môi trường');
      }
      this.aiClient = new GoogleGenAI({ apiKey: key });
    }
    return this.aiClient;
  }

  public async health(): Promise<AIHealthStatus> {
    const start = Date.now();
    const hasKey = Boolean(process.env.GEMINI_API_KEY);
    if (!hasKey) {
      return { healthy: false, message: 'Chưa cấu hình GEMINI_API_KEY', latencyMs: 0 };
    }
    return { healthy: true, message: 'Gemini sẵn sàng', latencyMs: Date.now() - start };
  }

  public async generateText(prompt: string, options?: AIGenerateOptions): Promise<string> {
    const client = this.getClient();
    const model = options?.modelId || 'gemini-2.5-flash';

    const response = await client.models.generateContent({
      model,
      contents: prompt,
      config: {
        temperature: options?.temperature ?? 0.7,
        systemInstruction: options?.systemInstruction
      }
    });

    return response.text || '';
  }

  public async generateStructured<T>(prompt: string, schemaDescription: string, options?: AIGenerateOptions): Promise<T> {
    const client = this.getClient();
    const model = options?.modelId || 'gemini-2.5-flash';

    const fullPrompt = `${prompt}\n\nYêu cầu cấu trúc JSON phản hồi:\n${schemaDescription}\nChỉ trả về JSON thuần túy, không kèm markdown \`\`\`json.`;

    const response = await client.models.generateContent({
      model,
      contents: fullPrompt,
      config: {
        temperature: options?.temperature ?? 0.2,
        systemInstruction: options?.systemInstruction,
        responseMimeType: 'application/json'
      }
    });

    const text = response.text || '{}';
    return JSON.parse(text) as T;
  }
}
