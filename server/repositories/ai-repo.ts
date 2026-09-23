import { D1Database } from '../db/d1-interface.ts';
import { AIProviderConfig, AIModelConfig, AITaskRoutingConfig, AITaskClass, AIProviderType } from '../contracts/index.ts';

import { encryptSecret } from '../auth/crypto.ts';

export class AIRepository {
  private db: D1Database;
  private initialized = false;

  constructor(db: D1Database) {
    this.db = db;
  }

  public async ensureSeedData() {
    if (this.initialized) return;

    const defaultProviders = [
      { id: 'provider_gemini', type: 'gemini', name: 'Google Gemini', endpoint: '', enabled: 1, isLocal: 0 },
      { id: 'provider_openai', type: 'openai', name: 'OpenAI (GPT-4o)', endpoint: 'https://api.openai.com/v1', enabled: 1, isLocal: 0 },
      { id: 'provider_anthropic', type: 'anthropic', name: 'Anthropic Claude', endpoint: 'https://api.anthropic.com/v1', enabled: 1, isLocal: 0 },
      { id: 'provider_openrouter', type: 'openrouter', name: 'OpenRouter Aggregator', endpoint: 'https://openrouter.ai/api/v1', enabled: 1, isLocal: 0 },
      { id: 'provider_local_ai', type: 'local_ai', name: 'Local AI (Ollama / LM Studio)', endpoint: 'http://localhost:11434/v1', enabled: 1, isLocal: 1 }
    ];

    const now = new Date().toISOString();
    for (const p of defaultProviders) {
      await this.db.prepare(
        `INSERT OR REPLACE INTO ai_providers (id, provider_type, display_name, endpoint, enabled, is_local, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(p.id, p.type, p.name, p.endpoint, p.enabled, p.isLocal, now, now).run();
    }

    const defaultModels = [
      { id: 'model_gemini_flash', providerId: 'provider_gemini', modelId: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', capabilities: ['text', 'vision', 'structured'], isDefault: 1 },
      { id: 'model_gemini_pro', providerId: 'provider_gemini', modelId: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', capabilities: ['text', 'vision', 'structured'], isDefault: 0 },
      { id: 'model_gpt4o', providerId: 'provider_openai', modelId: 'gpt-4o', name: 'GPT-4o Omni', capabilities: ['text', 'vision', 'structured'], isDefault: 0 },
      { id: 'model_claude_sonnet', providerId: 'provider_anthropic', modelId: 'claude-3-7-sonnet', name: 'Claude 3.7 Sonnet', capabilities: ['text', 'vision', 'structured'], isDefault: 0 },
      { id: 'model_deepseek_v3', providerId: 'provider_openrouter', modelId: 'deepseek/deepseek-chat', name: 'DeepSeek V3 (OpenRouter)', capabilities: ['text', 'structured'], isDefault: 0 },
      { id: 'model_ollama_local', providerId: 'provider_local_ai', modelId: 'qwen2.5:7b', name: 'Qwen 2.5 7B (Local Ollama)', capabilities: ['text', 'structured'], isDefault: 0 }
    ];

    for (const m of defaultModels) {
      await this.db.prepare(
        `INSERT OR REPLACE INTO ai_models (id, provider_id, model_id, display_name, capabilities_json, is_default, enabled, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
      ).bind(m.id, m.providerId, m.modelId, m.name, JSON.stringify(m.capabilities), m.isDefault, now).run();
    }

    const defaultRouting: Array<{ task: AITaskClass; primary: string; fallback: string }> = [
      { task: 'INTENT_UNDERSTANDING', primary: 'model_gemini_flash', fallback: 'model_gpt4o' },
      { task: 'KEYWORD_TRANSLATION', primary: 'model_gemini_flash', fallback: 'model_ollama_local' },
      { task: 'SEARCH_PLANNING', primary: 'model_gemini_flash', fallback: 'model_gpt4o' },
      { task: 'BROWSER_DECISION', primary: 'model_gemini_flash', fallback: 'model_claude_sonnet' },
      { task: 'PRODUCT_ANALYSIS', primary: 'model_gemini_flash', fallback: 'model_gpt4o' },
      { task: 'FACEBOOK_ADS_RESEARCH', primary: 'model_gemini_flash', fallback: 'model_gpt4o' },
      { task: 'SUMMARY', primary: 'model_gemini_flash', fallback: 'model_claude_sonnet' }
    ];

    for (const r of defaultRouting) {
      await this.db.prepare(
        `INSERT OR REPLACE INTO ai_task_routing (task_class, primary_model_id, fallback_model_id, updated_at)
         VALUES (?, ?, ?, ?)`
      ).bind(r.task, r.primary, r.fallback, now).run();
    }

    this.initialized = true;
  }

  public async getProviders(): Promise<AIProviderConfig[]> {
    await this.ensureSeedData();
    const rows = await this.db.prepare(`SELECT * FROM ai_providers ORDER BY is_local ASC, display_name ASC`).all<any>();

    return (rows.results || []).map(r => ({
      id: r.id,
      providerType: r.provider_type as AIProviderType,
      displayName: r.display_name,
      endpoint: r.endpoint,
      enabled: Boolean(r.enabled),
      isLocal: Boolean(r.is_local),
      isConfigured: r.is_local ? true : Boolean(r.api_key_encrypted || process.env.GEMINI_API_KEY),
      healthState: 'HEALTHY'
    }));
  }

  public async listProviders(): Promise<AIProviderConfig[]> {
    return this.getProviders();
  }

  public async getModels(): Promise<AIModelConfig[]> {
    await this.ensureSeedData();
    const rows = await this.db.prepare(`SELECT * FROM ai_models WHERE enabled = 1 ORDER BY is_default DESC, display_name ASC`).all<any>();
    return (rows.results || []).map(r => ({
      id: r.id,
      providerId: r.provider_id,
      modelId: r.model_id,
      displayName: r.display_name,
      capabilities: JSON.parse(r.capabilities_json || '["text"]'),
      isDefault: Boolean(r.is_default),
      enabled: Boolean(r.enabled)
    }));
  }

  public async listModels(): Promise<AIModelConfig[]> {
    return this.getModels();
  }

  public async getRouting(): Promise<AITaskRoutingConfig[]> {
    await this.ensureSeedData();
    const rows = await this.db.prepare(`SELECT * FROM ai_task_routing`).all<any>();
    return (rows.results || []).map(r => ({
      taskClass: r.task_class as AITaskClass,
      primaryModelId: r.primary_model_id,
      fallbackModelId: r.fallback_model_id
    }));
  }

  public async updateRouting(taskClass: AITaskClass, primaryModelId: string, fallbackModelId?: string): Promise<void> {
    await this.ensureSeedData();
    const now = new Date().toISOString();
    await this.db.prepare(
      `INSERT OR REPLACE INTO ai_task_routing (task_class, primary_model_id, fallback_model_id, updated_at)
       VALUES (?, ?, ?, ?)`
    ).bind(taskClass, primaryModelId, fallbackModelId || null, now).run();
  }

  public async saveProviderSecret(providerId: string, apiKey: string): Promise<void> {
    await this.ensureSeedData();
    const encrypted = encryptSecret(apiKey);
    const now = new Date().toISOString();
    await this.db.prepare(
      `UPDATE ai_providers SET api_key_encrypted = ?, updated_at = ? WHERE id = ?`
    ).bind(encrypted, now, providerId).run();
  }
}
