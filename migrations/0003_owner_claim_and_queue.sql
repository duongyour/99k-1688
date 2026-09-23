-- 0003_owner_claim_and_queue.sql: Singleton Owner Bootstrap, Evidence R2 Objects, OAuth 2.1, and Research Queue

-- 1. Singleton Owner Bootstrap Claim Table (Database-Enforced Concurrency Constraint)
CREATE TABLE IF NOT EXISTS owner_bootstrap_claim (
  claim_key TEXT PRIMARY KEY, -- Canonical singleton key: 'SINGLETON_OWNER'
  user_id TEXT NOT NULL,
  claimed_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 2. Evidence Storage R2 Objects Reference Table
CREATE TABLE IF NOT EXISTS evidence_objects (
  id TEXT PRIMARY KEY,
  job_id TEXT,
  product_id TEXT,
  r2_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

-- 3. OAuth 2.1 Remote MCP Client Authorization Tables
CREATE TABLE IF NOT EXISTS oauth_clients (
  client_id TEXT PRIMARY KEY,
  client_secret_hash TEXT,
  client_name TEXT NOT NULL,
  redirect_uris_json TEXT NOT NULL DEFAULT '[]',
  scopes_json TEXT NOT NULL DEFAULT '["research.create","products.view","suppliers.view","shortlists.manage"]',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
  code_hash TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  scopes_json TEXT NOT NULL,
  code_challenge TEXT,
  code_challenge_method TEXT,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_tokens (
  token_hash TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  scopes_json TEXT NOT NULL,
  token_type TEXT NOT NULL DEFAULT 'Bearer',
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);

-- 4. Research Queue Message Execution Ledger
CREATE TABLE IF NOT EXISTS research_queue_messages (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'PAUSED_HUMAN_ACTION'
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
