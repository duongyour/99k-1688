-- 0002_multi_ai_and_device.sql: Multi-AI Architecture, MCP Tokens, and Pairing Grants

CREATE TABLE IF NOT EXISTS ai_providers (
  id TEXT PRIMARY KEY,
  provider_type TEXT NOT NULL, -- 'gemini', 'openai', 'anthropic', 'openrouter', 'local_ai'
  display_name TEXT NOT NULL,
  endpoint TEXT,
  api_key_encrypted TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  is_local INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_models (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  capabilities_json TEXT NOT NULL DEFAULT '["text"]',
  is_default INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  FOREIGN KEY (provider_id) REFERENCES ai_providers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_task_routing (
  task_class TEXT PRIMARY KEY, -- 'INTENT_UNDERSTANDING', 'KEYWORD_TRANSLATION', 'SEARCH_PLANNING', 'BROWSER_DECISION', 'PRODUCT_ANALYSIS', 'FACEBOOK_ADS_RESEARCH', 'SUMMARY'
  primary_model_id TEXT NOT NULL,
  fallback_model_id TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pair_grants (
  id TEXT PRIMARY KEY,
  token_hash TEXT UNIQUE NOT NULL,
  created_by TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mcp_tokens (
  id TEXT PRIMARY KEY,
  token_hash TEXT UNIQUE NOT NULL,
  client_name TEXT NOT NULL,
  scopes_json TEXT NOT NULL DEFAULT '["research:read"]',
  user_id TEXT NOT NULL,
  expires_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
