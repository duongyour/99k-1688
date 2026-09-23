import { AIProvider, AIGenerateOptions, AIHealthStatus } from './provider-interface.ts';
import { AIProviderType } from '../contracts/index.ts';

export class OpenAICompatibleProvider implements AIProvider {
  public readonly id: string;
  public readonly displayName: string;
  public readonly providerType: AIProviderType;
  private endpoint: string;
  private apiKey?: string;

  constructor(options: {
    id: string;
    displayName: string;
    providerType: AIProviderType;
    endpoint: string;
    apiKey?: string;
  }) {
    this.id = options.id;
    this.displayName = options.displayName;
    this.providerType = options.providerType;
    this.endpoint = options.endpoint.replace(/\/+$/, '');
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY;
  }

  public async health(): Promise<AIHealthStatus> {
    const start = Date.now();
    try {
      const res = await fetch(`${this.endpoint}/models`, {
        headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}
      });
      if (res.ok) {
        return { healthy: true, message: `${this.displayName} phản hồi tốt`, latencyMs: Date.now() - start };
      }
      return { healthy: false, message: `HTTP ${res.status}: ${res.statusText}`, latencyMs: Date.now() - start };
    } catch (err: any) {
      return { healthy: false, message: err.message || 'Không thể kết nối', latencyMs: Date.now() - start };
    }
  }

  public async generateText(prompt: string, options?: AIGenerateOptions): Promise<string> {
    const model = options?.modelId || 'gpt-4o';
    const messages: any[] = [];

    if (options?.systemInstruction) {
      messages.push({ role: 'system', content: options.systemInstruction });
    }
    messages.push({ role: 'user', content: prompt });

    const res = await fetch(`${this.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {})
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2000
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`${this.displayName} API error (${res.status}): ${errText}`);
    }

    const data: any = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }

  public async generateStructured<T>(prompt: string, schemaDescription: string, options?: AIGenerateOptions): Promise<T> {
    const model = options?.modelId || 'gpt-4o';
    const system = `${options?.systemInstruction || ''}\nYêu cầu định dạng JSON phản hồi:\n${schemaDescription}\nChỉ trả về JSON thuần túy, không kèm markdown.`;

    const res = await fetch(`${this.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {})
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt }
        ],
        temperature: options?.temperature ?? 0.2,
        response_format: { type: 'json_object' }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`${this.displayName} API error (${res.status}): ${errText}`);
    }

    const data: any = await res.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    return JSON.parse(content) as T;
  }
}
