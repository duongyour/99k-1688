import { AIProvider } from './provider-interface.ts';
import { GeminiProvider } from './gemini-adapter.ts';
import { OpenAICompatibleProvider } from './openai-adapter.ts';
import { AnthropicProvider } from './anthropic-adapter.ts';
import { AITaskClass } from '../contracts/index.ts';
import { AIRepository } from '../repositories/ai-repo.ts';

export class AIModelRouter {
  private providers: Map<string, AIProvider> = new Map();
  private aiRepo: AIRepository;

  constructor(aiRepo: AIRepository) {
    this.aiRepo = aiRepo;
    this.initDefaultProviders();
  }

  private initDefaultProviders() {
    // 1. Google Gemini
    this.providers.set('provider_gemini', new GeminiProvider());

    // 2. OpenAI
    this.providers.set('provider_openai', new OpenAICompatibleProvider({
      id: 'provider_openai',
      displayName: 'OpenAI (GPT-4o)',
      providerType: 'openai',
      endpoint: 'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_API_KEY
    }));

    // 3. Anthropic Claude
    this.providers.set('provider_anthropic', new AnthropicProvider(process.env.ANTHROPIC_API_KEY));

    // 4. OpenRouter
    this.providers.set('provider_openrouter', new OpenAICompatibleProvider({
      id: 'provider_openrouter',
      displayName: 'OpenRouter Aggregator',
      providerType: 'openrouter',
      endpoint: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY
    }));

    // 5. Local AI (Ollama at localhost:11434/v1 or LM Studio at localhost:1234/v1)
    this.providers.set('provider_local_ai', new OpenAICompatibleProvider({
      id: 'provider_local_ai',
      displayName: 'Local AI (Ollama / LM Studio)',
      providerType: 'local_ai',
      endpoint: process.env.LOCAL_AI_ENDPOINT || 'http://localhost:11434/v1'
    }));
  }

  public getProvider(providerId: string): AIProvider | undefined {
    return this.providers.get(providerId);
  }

  public registerProvider(provider: AIProvider) {
    this.providers.set(provider.id, provider);
  }

  /**
   * Execute task with automatic fallback
   */
  public async executeStructuredTask<T>(
    taskClass: AITaskClass,
    prompt: string,
    schemaDescription: string,
    systemInstruction?: string
  ): Promise<{ result: T; provenance: { providerId: string; modelId: string; fellBack: boolean } }> {
    const routingList = await this.aiRepo.getRouting();
    const taskRoute = routingList.find(r => r.taskClass === taskClass);

    const primaryModelId = taskRoute?.primaryModelId || 'gemini-2.5-flash';
    const fallbackModelId = taskRoute?.fallbackModelId;

    // Resolve provider from modelId
    const primaryProvider = this.resolveProviderForModel(primaryModelId);

    try {
      if (!primaryProvider) {
        throw new Error(`Không tìm thấy nhà cung cấp AI cho model '${primaryModelId}'`);
      }

      const result = await primaryProvider.generateStructured<T>(prompt, schemaDescription, {
        modelId: this.getRawModelName(primaryModelId),
        systemInstruction
      });

      return {
        result,
        provenance: { providerId: primaryProvider.id, modelId: primaryModelId, fellBack: false }
      };
    } catch (primaryErr: any) {
      console.warn(`[AI Router] Primary model '${primaryModelId}' failed for task '${taskClass}': ${primaryErr.message}. Attempting fallback.`);

      if (fallbackModelId) {
        const fallbackProvider = this.resolveProviderForModel(fallbackModelId);
        if (fallbackProvider) {
          try {
            const fallbackResult = await fallbackProvider.generateStructured<T>(prompt, schemaDescription, {
              modelId: this.getRawModelName(fallbackModelId),
              systemInstruction
            });

            return {
              result: fallbackResult,
              provenance: { providerId: fallbackProvider.id, modelId: fallbackModelId, fellBack: true }
            };
          } catch (fallbackErr: any) {
            console.error(`[AI Router] Fallback model '${fallbackModelId}' also failed: ${fallbackErr.message}`);
          }
        }
      }

      throw primaryErr;
    }
  }

  private resolveProviderForModel(modelIdentifier: string): AIProvider | undefined {
    if (modelIdentifier.includes('gemini') || modelIdentifier === 'model_gemini_flash' || modelIdentifier === 'model_gemini_pro') {
      return this.providers.get('provider_gemini');
    }
    if (modelIdentifier.includes('gpt') || modelIdentifier === 'model_gpt4o') {
      return this.providers.get('provider_openai');
    }
    if (modelIdentifier.includes('claude') || modelIdentifier === 'model_claude_sonnet') {
      return this.providers.get('provider_anthropic');
    }
    if (modelIdentifier.includes('deepseek') || modelIdentifier === 'model_deepseek_v3') {
      return this.providers.get('provider_openrouter');
    }
    if (modelIdentifier.includes('ollama') || modelIdentifier.includes('qwen') || modelIdentifier === 'model_ollama_local') {
      return this.providers.get('provider_local_ai');
    }

    return this.providers.get('provider_gemini');
  }

  private getRawModelName(modelIdentifier: string): string {
    switch (modelIdentifier) {
      case 'model_gemini_flash':
        return 'gemini-2.5-flash';
      case 'model_gemini_pro':
        return 'gemini-2.5-pro';
      case 'model_gpt4o':
        return 'gpt-4o';
      case 'model_claude_sonnet':
        return 'claude-3-7-sonnet-20250219';
      case 'model_deepseek_v3':
        return 'deepseek/deepseek-chat';
      case 'model_ollama_local':
        return 'qwen2.5:7b';
      default:
        return modelIdentifier;
    }
  }

  public async routeTask(taskClass: string, payload: any): Promise<any> {
    const prompt = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const validTaskClass: AITaskClass = (taskClass === 'PRODUCT_EVALUATION' ? 'PRODUCT_ANALYSIS' : taskClass) as AITaskClass;
    return this.executeStructuredTask(
      validTaskClass,
      prompt,
      'Schema for AI evaluation analysis',
      'You are an expert e-commerce and product research intelligence agent.'
    ).then(res => res.result);
  }
}
