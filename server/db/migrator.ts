import { D1Database } from './d1-interface.ts';
import fs from 'fs';
import path from 'path';

/**
 * Executes D1 SQL Migrations from migrations/ directory
 * Records applied migrations to ensure schema authority
 */
export async function applyMigrations(db: D1Database, migrationsDir?: string): Promise<string[]> {
  const dir = migrationsDir || path.join(process.cwd(), 'migrations');
  if (!fs.existsSync(dir)) {
    return [];
  }

  // Ensure migration tracking table exists
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS _cf_d1_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `).run();

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  const applied: string[] = [];

  for (const file of files) {
    const check = await db.prepare(`SELECT id FROM _cf_d1_migrations WHERE id = ?`).bind(file).first<{ id: string }>();
    if (check) {
      continue;
    }

    const sqlContent = fs.readFileSync(path.join(dir, file), 'utf8');
    // Split statements by semicolon, avoiding inside blocks
    const statements = sqlContent
      .split(/;\s*$/m)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const stmt of statements) {
      if (stmt.trim()) {
        await db.prepare(stmt).run();
      }
    }

    const now = new Date().toISOString();
    await db.prepare(`INSERT INTO _cf_d1_migrations (id, applied_at) VALUES (?, ?)`).bind(file, now).run();
    applied.push(file);
  }

  return applied;
}
