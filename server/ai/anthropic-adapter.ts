import { AIProvider, AIGenerateOptions, AIHealthStatus } from './provider-interface.ts';

export class AnthropicProvider implements AIProvider {
  public readonly id = 'provider_anthropic';
  public readonly displayName = 'Anthropic Claude';
  public readonly providerType = 'anthropic' as const;
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY;
  }

  public async health(): Promise<AIHealthStatus> {
    const start = Date.now();
    const hasKey = Boolean(this.apiKey);
    if (!hasKey) {
      return { healthy: false, message: 'Chưa cấu hình ANTHROPIC_API_KEY', latencyMs: 0 };
    }
    return { healthy: true, message: 'Anthropic Claude sẵn sàng', latencyMs: Date.now() - start };
  }

  public async generateText(prompt: string, options?: AIGenerateOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error('ANTHROPIC_API_KEY chưa được cấu hình');
    }

    const model = options?.modelId || 'claude-3-7-sonnet-20250219';
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        system: options?.systemInstruction,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: options?.maxTokens ?? 2000,
        temperature: options?.temperature ?? 0.7
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Anthropic API error (${res.status}): ${errText}`);
    }

    const data: any = await res.json();
    return data.content?.[0]?.text || '';
  }

  public async generateStructured<T>(prompt: string, schemaDescription: string, options?: AIGenerateOptions): Promise<T> {
    const fullPrompt = `${prompt}\n\nYêu cầu trả về JSON chuẩn theo cấu trúc:\n${schemaDescription}\nChỉ xuất JSON thuần túy.`;
    const text = await this.generateText(fullPrompt, { ...options, temperature: 0.1 });
    const cleanJson = text.replace(/```json\s*|\s*```/g, '').trim();
    return JSON.parse(cleanJson) as T;
  }
}
