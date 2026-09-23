-- 0001_initial.sql: Canonical D1 / Relational Schema for 1688 Product Research & Studio

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_algo TEXT NOT NULL DEFAULT 'pbkdf2_sha256',
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memberships (
  user_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL', -- 'OWNER', 'ACTIVE', 'PENDING_APPROVAL', 'REJECTED', 'DEACTIVATED'
  approved_by TEXT,
  approved_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_builtin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS permissions (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id TEXT NOT NULL,
  permission_key TEXT NOT NULL,
  PRIMARY KEY (role_id, permission_key),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_key) REFERENCES permissions(key) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS member_roles (
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  PRIMARY KEY (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS browser_devices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  pairing_token TEXT UNIQUE NOT NULL,
  device_secret TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DISCONNECTED', -- 'CONNECTED', 'DISCONNECTED', 'HUMAN_ACTION_REQUIRED'
  ip_address TEXT,
  last_seen TEXT,
  paired_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS browser_connections (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  tab_url TEXT,
  is_logged_in_1688 INTEGER NOT NULL DEFAULT 0,
  human_action_required INTEGER NOT NULL DEFAULT 0,
  human_action_reason TEXT,
  current_task TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (device_id) REFERENCES browser_devices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS search_jobs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  raw_query TEXT NOT NULL,
  creator_id TEXT NOT NULL,
  creator_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'HUMAN_ACTION_REQUIRED'
  max_price_cny REAL NOT NULL DEFAULT 30.0,
  min_price_cny REAL DEFAULT 0.0,
  category TEXT,
  moq_max INTEGER,
  require_video INTEGER NOT NULL DEFAULT 0,
  small_light INTEGER NOT NULL DEFAULT 1,
  exclude_brand INTEGER NOT NULL DEFAULT 1,
  result_target_count INTEGER NOT NULL DEFAULT 12,
  chinese_keywords TEXT,
  total_candidates INTEGER NOT NULL DEFAULT 0,
  verified_candidates INTEGER NOT NULL DEFAULT 0,
  rejected_candidates INTEGER NOT NULL DEFAULT 0,
  human_action_required INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  canonical_supplier_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  location TEXT,
  factory_signals TEXT,
  rating_score REAL,
  years_on_platform INTEGER,
  captured_products_count INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  canonical_1688_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  title_zh TEXT NOT NULL,
  source_url TEXT NOT NULL,
  main_image TEXT NOT NULL,
  price_displayed_min REAL NOT NULL,
  price_displayed_max REAL NOT NULL,
  verified_variant_price REAL,
  price_status TEXT NOT NULL DEFAULT 'PRICE_UNVERIFIED', -- 'VERIFIED', 'PRICE_UNVERIFIED', 'ACCESSORY_TRAP_REJECTED'
  moq INTEGER NOT NULL DEFAULT 1,
  supplier_id TEXT,
  supplier_name TEXT NOT NULL,
  category TEXT,
  weight_kg REAL,
  has_video INTEGER NOT NULL DEFAULT 0,
  video_url TEXT,
  raw_snapshot_reference TEXT,
  research_state TEXT NOT NULL DEFAULT 'NEW', -- 'NEW', 'SHORTLISTED', 'SAVED', 'REJECTED'
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  sku_id TEXT NOT NULL,
  name TEXT NOT NULL,
  name_zh TEXT NOT NULL,
  price_cny REAL NOT NULL,
  is_accessory INTEGER NOT NULL DEFAULT 0,
  is_main_product INTEGER NOT NULL DEFAULT 1,
  image_url TEXT,
  stock INTEGER,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_price_tiers (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  min_quantity INTEGER NOT NULL,
  price_cny REAL NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_media (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'IMAGE', -- 'IMAGE', 'VIDEO', 'CLEANED_STUDIO_IMAGE'
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  cleaned_url TEXT,
  prompt_instruction TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_assessments (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  job_id TEXT,
  hook_clarity INTEGER NOT NULL DEFAULT 8,
  demonstrability INTEGER NOT NULL DEFAULT 8,
  before_after_potential INTEGER NOT NULL DEFAULT 7,
  problem_solution_strength INTEGER NOT NULL DEFAULT 8,
  novelty_curiosity INTEGER NOT NULL DEFAULT 8,
  visual_media_quality INTEGER NOT NULL DEFAULT 8,
  small_light_suitability INTEGER NOT NULL DEFAULT 9,
  retail_headroom_hypothesis TEXT,
  return_support_risk TEXT,
  brand_ip_risk TEXT,
  strengths_json TEXT NOT NULL DEFAULT '[]',
  risks_json TEXT NOT NULL DEFAULT '[]',
  unknowns_json TEXT NOT NULL DEFAULT '[]',
  recommendation_status TEXT NOT NULL DEFAULT 'RECOMMENDED', -- 'RECOMMENDED', 'CONSIDER', 'REJECTED'
  created_at TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS shortlists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shortlist_items (
  id TEXT PRIMARY KEY,
  shortlist_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  notes TEXT,
  added_at TEXT NOT NULL,
  FOREIGN KEY (shortlist_id) REFERENCES shortlists(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE(shortlist_id, product_id)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT '1688 Product Research & Studio',
  default_price_ceiling_cny REAL NOT NULL DEFAULT 30.0,
  registration_open INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
