import { AIProviderType, AITaskClass } from '../contracts/index.ts';

export interface AIGenerateOptions {
  temperature?: number;
  maxTokens?: number;
  modelId?: string;
  systemInstruction?: string;
}

export interface AIHealthStatus {
  healthy: boolean;
  message?: string;
  latencyMs?: number;
}

export interface AIProvider {
  readonly id: string;
  readonly displayName: string;
  readonly providerType: AIProviderType;

  health(): Promise<AIHealthStatus>;
  generateText(prompt: string, options?: AIGenerateOptions): Promise<string>;
  generateStructured<T>(prompt: string, schemaDescription: string, options?: AIGenerateOptions): Promise<T>;
}
