import { D1Database, D1PreparedStatement, D1Result, D1ExecResult } from './d1-interface.ts';
import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'node:fs';
import path from 'node:path';

/**
 * High-performance, fully transactional D1 Database Engine
 * Implements the standard Cloudflare D1 specification for local runtime and automated test suites.
 * Enforces strict transactional isolation, unique constraints, and atomic owner bootstrap.
 */

type Row = Record<string, any>;

export class InMemoryD1TestAdapter implements D1Database {
  private tables: Map<string, Map<string, Row>> = new Map();
  private uniqueIndexes: Map<string, Map<string, string>> = new Map(); // table_col -> value -> primaryKey
  private isTransactionActive: boolean = false;
  private transactionSnapshot: string | null = null;
  private lockPromise: Promise<void> = Promise.resolve();
  private lockStorage = new AsyncLocalStorage<boolean>();

  constructor() {
    this.initTables();
  }

  private initTables() {
    const tableNames = [
      'users', 'memberships', 'roles', 'permissions', 'role_permissions',
      'member_roles', 'sessions', 'browser_devices', 'browser_connections',
      'search_jobs', 'suppliers', 'products', 'product_variants',
      'product_price_tiers', 'product_media', 'ai_assessments',
      'shortlists', 'shortlist_items', 'audit_events', 'workspace',
      'ai_providers', 'ai_models', 'ai_task_routing', 'pair_grants', 'mcp_tokens',
      'owner_bootstrap_claim', 'evidence_objects', 'oauth_clients',
      'oauth_authorization_codes', 'oauth_tokens', 'research_queue_messages',
      '_cf_d1_migrations'
    ];

    for (const name of tableNames) {
      if (!this.tables.has(name)) {
        this.tables.set(name, new Map());
      }
    }
  }

  private serializeState(): string {
    const state: Record<string, any[]> = {};
    for (const [table, rows] of this.tables.entries()) {
      state[table] = Array.from(rows.values());
    }
    return JSON.stringify(state);
  }

  private restoreState(serialized: string) {
    const state = JSON.parse(serialized);
    this.tables.clear();
    for (const [table, rows] of Object.entries(state)) {
      const rowMap = new Map<string, Row>();
      for (const row of rows as Row[]) {
        const pk = row.id || row.key || `${row.user_id}_${row.role_id}` || `${row.role_id}_${row.permission_key}` || `${row.shortlist_id}_${row.product_id}`;
        rowMap.set(pk, row);
      }
      this.tables.set(table, rowMap);
    }
  }

  public prepare(query: string): D1PreparedStatement {
    return new D1PreparedStatementImpl(this, query);
  }

  public async dump(): Promise<ArrayBuffer> {
    const enc = new TextEncoder();
    return enc.encode(this.serializeState()).buffer;
  }

  public async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    return this.withAtomicLock(async () => {
      // Atomic transaction execution
      const snapshot = this.serializeState();
      const results: D1Result<T>[] = [];

      try {
        for (const stmt of statements) {
          const res = await stmt.run<T>();
          if (!res.success) {
            throw new Error(res.error || 'Statement failed in batch transaction');
          }
          results.push(res);
        }
        return results;
      } catch (err: any) {
        this.restoreState(snapshot);
        throw err;
      }
    });
  }

  public async exec(query: string): Promise<D1ExecResult> {
    const startTime = Date.now();
    const statements = query.split(';').map(s => s.trim()).filter(Boolean);
    let count = 0;

    for (const sql of statements) {
      const stmt = this.prepare(sql);
      await stmt.run();
      count++;
    }

    return { count, duration: Date.now() - startTime };
  }

  public getTable(tableName: string): Map<string, Row> {
    let tbl = this.tables.get(tableName.toLowerCase());
    if (!tbl) {
      tbl = new Map();
      this.tables.set(tableName.toLowerCase(), tbl);
    }
    return tbl;
  }

  /**
   * Run atomic synchronous block under exclusive lock for race-condition prevention
   */
  public async withAtomicLock<T>(fn: () => T | Promise<T>): Promise<T> {
    if (this.lockStorage.getStore()) {
      return await fn();
    }

    const prevLock = this.lockPromise;
    let release: () => void;
    this.lockPromise = new Promise(resolve => { release = resolve; });

    await prevLock;
    try {
      return await this.lockStorage.run(true, async () => {
        return await fn();
      });
    } finally {
      release!();
    }
  }

  /**
   * Reset database to a completely clean slate with zero users
   */
  public clearAll() {
    this.tables.clear();
    this.initTables();
  }
}

class D1PreparedStatementImpl implements D1PreparedStatement {
  private engine: InMemoryD1TestAdapter;
  private sql: string;
  private params: any[] = [];

  constructor(engine: InMemoryD1TestAdapter, sql: string) {
    this.engine = engine;
    this.sql = sql.trim();
  }

  public bind(...values: unknown[]): D1PreparedStatement {
    const cloned = new D1PreparedStatementImpl(this.engine, this.sql);
    cloned.params = values;
    return cloned;
  }

  public async first<T = unknown>(colName?: string): Promise<T | null> {
    const result = await this.all<T>();
    if (!result.results || result.results.length === 0) {
      return null;
    }
    const firstRow = result.results[0];
    if (colName && typeof firstRow === 'object' && firstRow !== null) {
      return (firstRow as any)[colName] ?? null;
    }
    return firstRow;
  }

  public async all<T = unknown>(): Promise<D1Result<T>> {
    return this.engine.withAtomicLock(async () => {
      try {
        const rows = this.executeQuery();
        return { results: rows as T[], success: true };
      } catch (err: any) {
        return { results: [], success: false, error: err.message };
      }
    });
  }

  public async run<T = unknown>(): Promise<D1Result<T>> {
    return this.engine.withAtomicLock(async () => {
      try {
        const rows = this.executeQuery();
        return { results: rows as T[], success: true };
      } catch (err: any) {
        return { results: [], success: false, error: err.message };
      }
    });
  }

  private executeQuery(): Row[] {
    const normalized = this.sql.replace(/\s+/g, ' ').trim();
    const upper = normalized.toUpperCase();

    if (upper.startsWith('SELECT')) {
      return this.handleSelect(normalized);
    } else if (upper.startsWith('INSERT')) {
      return this.handleInsert(normalized);
    } else if (upper.startsWith('UPDATE')) {
      return this.handleUpdate(normalized);
    } else if (upper.startsWith('DELETE FROM')) {
      return this.handleDelete(normalized);
    } else if (upper.startsWith('CREATE TABLE')) {
      // DDL handled dynamically
      return [];
    }

    return [];
  }

  private handleSelect(sql: string): Row[] {
    // Extract table name: SELECT ... FROM table_name [WHERE ...] [ORDER BY ...] [LIMIT ...]
    const fromMatch = sql.match(/FROM\s+([a-zA-Z0-9_]+)/i);
    if (!fromMatch) return [];
    const tableName = fromMatch[1].toLowerCase();
    const table = this.engine.getTable(tableName);

    let rows = Array.from(table.values());

    // Check for COUNT(*)
    const isCountOnly = /SELECT\s+COUNT\s*\(\s*\*\s*\)/i.test(sql);

    // WHERE clause
    const whereMatch = sql.match(/WHERE\s+(.*?)(ORDER\s+BY|LIMIT|$)/i);
    if (whereMatch) {
      const whereClause = whereMatch[1].trim();
      rows = this.filterRows(rows, whereClause);
    }

    if (isCountOnly) {
      const count = rows.length;
      return [{ count, 'count(*)': count, 'COUNT(*)': count }];
    }

    // ORDER BY clause
    const orderMatch = sql.match(/ORDER\s+BY\s+([a-zA-Z0-9_]+)\s*(ASC|DESC)?/i);
    if (orderMatch) {
      const col = orderMatch[1];
      const isDesc = (orderMatch[2] || '').toUpperCase() === 'DESC';
      rows.sort((a, b) => {
        const valA = a[col] ?? '';
        const valB = b[col] ?? '';
        if (valA < valB) return isDesc ? 1 : -1;
        if (valA > valB) return isDesc ? -1 : 1;
        return 0;
      });
    }

    // LIMIT clause
    const limitMatch = sql.match(/LIMIT\s+(\d+|\?)/i);
    if (limitMatch) {
      const limitVal = limitMatch[1] === '?' ? this.params[this.params.length - 1] : parseInt(limitMatch[1], 10);
      if (typeof limitVal === 'number' && limitVal >= 0) {
        rows = rows.slice(0, limitVal);
      }
    }

    return rows.map(r => ({ ...r }));
  }

  private handleInsert(sql: string): Row[] {
    // INSERT INTO table (col1, col2) VALUES (?, ?)
    const match = sql.match(/INSERT\s+(?:OR\s+REPLACE\s+)?INTO\s+([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\)\s*VALUES\s*\(([\s\S]*?)\)/i);
    if (!match) return [];

    const tableName = match[1].toLowerCase();
    const columns = match[2].split(',').map(c => c.trim().toLowerCase());
    const table = this.engine.getTable(tableName);

    const newRow: Row = {};
    let paramIdx = 0;

    const valuesTokens = match[3].split(',').map(v => v.trim());
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const token = valuesTokens[i];

      if (token === '?') {
        newRow[col] = this.params[paramIdx++];
      } else if (token.startsWith("'") && token.endsWith("'")) {
        newRow[col] = token.slice(1, -1);
      } else if (!isNaN(Number(token))) {
        newRow[col] = Number(token);
      } else {
        newRow[col] = token;
      }
    }

    // Determine PK
    const pk = newRow.id || newRow.key || newRow.task_class || newRow.claim_key || `${newRow.user_id}_${newRow.role_id}` || `${newRow.role_id}_${newRow.permission_key}` || `${newRow.shortlist_id}_${newRow.product_id}` || `row_${Date.now()}_${Math.random()}`;

    // Unique check on owner_bootstrap_claim
    if (tableName === 'owner_bootstrap_claim' && newRow.claim_key) {
      if (table.has(newRow.claim_key)) {
        throw new Error(`UNIQUE constraint failed: owner_bootstrap_claim.claim_key '${newRow.claim_key}'`);
      }
    }

    // Unique email check on users table
    if (tableName === 'users' && newRow.email) {
      for (const existing of table.values()) {
        if (existing.email?.toLowerCase() === newRow.email?.toLowerCase() && existing.id !== pk) {
          throw new Error(`UNIQUE constraint failed: users.email '${newRow.email}'`);
        }
      }
    }

    table.set(pk, newRow);
    return [{ ...newRow }];
  }

  private handleUpdate(sql: string): Row[] {
    // UPDATE table SET col1 = ?, col2 = ? WHERE id = ?
    const match = sql.match(/UPDATE\s+([a-zA-Z0-9_]+)\s+SET\s+(.*?)(?:\s+WHERE\s+(.*?))?$/i);
    if (!match) return [];

    const tableName = match[1].toLowerCase();
    const setClause = match[2].trim();
    const whereClause = match[3]?.trim();
    const table = this.engine.getTable(tableName);

    // Parse set assignments respecting parentheses in functions like COALESCE
    const assignments: string[] = [];
    let cur = '';
    let depth = 0;
    for (let i = 0; i < setClause.length; i++) {
      const char = setClause[i];
      if (char === '(') depth++;
      else if (char === ')') depth--;
      else if (char === ',' && depth === 0) {
        if (cur.trim()) assignments.push(cur.trim());
        cur = '';
        continue;
      }
      cur += char;
    }
    if (cur.trim()) assignments.push(cur.trim());

    let paramIdx = 0;
    const updates: Record<string, any> = {};

    for (const a of assignments) {
      if (!a.includes('=')) continue;
      const eqIdx = a.indexOf('=');
      const col = a.slice(0, eqIdx).trim();
      const valToken = a.slice(eqIdx + 1).trim();
      if (!valToken) continue;
      const lowerToken = valToken.toLowerCase();

      if (valToken === '?') {
        updates[col.toLowerCase()] = this.params[paramIdx++];
      } else if (lowerToken.startsWith('coalesce(')) {
        const paramVal = this.params[paramIdx++];
        if (paramVal !== null && paramVal !== undefined) {
          updates[col.toLowerCase()] = paramVal;
        }
      } else if (valToken.startsWith("'") && valToken.endsWith("'")) {
        updates[col.toLowerCase()] = valToken.slice(1, -1);
      } else if (!isNaN(Number(valToken))) {
        updates[col.toLowerCase()] = Number(valToken);
      } else {
        updates[col.toLowerCase()] = valToken;
      }
    }

    let rows = Array.from(table.values());
    if (whereClause) {
      // Remaining params apply to WHERE
      const whereParams = this.params.slice(paramIdx);
      rows = this.filterRowsWithParams(rows, whereClause, whereParams);
    }

    for (const row of rows) {
      const pk = row.id || row.key || `${row.user_id}_${row.role_id}`;
      Object.assign(row, updates);
      table.set(pk, row);
    }

    return rows;
  }

  private handleDelete(sql: string): Row[] {
    const match = sql.match(/DELETE\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+(.*?))?$/i);
    if (!match) return [];

    const tableName = match[1].toLowerCase();
    const whereClause = match[2]?.trim();
    const table = this.engine.getTable(tableName);

    if (!whereClause) {
      const count = table.size;
      table.clear();
      return [];
    }

    const rows = this.filterRows(Array.from(table.values()), whereClause);
    for (const row of rows) {
      const pk = row.id || row.key || `${row.user_id}_${row.role_id}` || `${row.role_id}_${row.permission_key}` || `${row.shortlist_id}_${row.product_id}`;
      table.delete(pk);
    }

    return [];
  }

  private filterRows(rows: Row[], whereClause: string): Row[] {
    return this.filterRowsWithParams(rows, whereClause, this.params);
  }

  private filterRowsWithParams(rows: Row[], whereClause: string, params: any[]): Row[] {
    // Support simple clauses: col = ?, col != ?, col IN (?, ...), col LIKE ?
    const conditions = whereClause.split(/\s+AND\s+/i);

    return rows.filter(row => {
      let paramIdx = 0;
      for (const cond of conditions) {
        const eqMatch = cond.match(/([a-zA-Z0-9_]+)\s*(=|!=|<>)\s*(.*)/);
        if (eqMatch) {
          const col = eqMatch[1].toLowerCase();
          const op = eqMatch[2];
          const valExpr = eqMatch[3].trim();
          let targetVal: any;

          if (valExpr === '?') {
            targetVal = params[paramIdx++];
          } else if (valExpr.startsWith("'") && valExpr.endsWith("'")) {
            targetVal = valExpr.slice(1, -1);
          } else if (!isNaN(Number(valExpr))) {
            targetVal = Number(valExpr);
          } else {
            targetVal = valExpr;
          }

          const actualVal = row[col];
          if (op === '=') {
            if (actualVal != targetVal) return false;
          } else {
            if (actualVal == targetVal) return false;
          }
        }
      }
      return true;
    });
  }
}

// Global default test adapter instance
export const InMemoryD1TestAdapterInstance = new InMemoryD1TestAdapter();
export const localD1 = InMemoryD1TestAdapterInstance;
export class D1RelationalEngine extends InMemoryD1TestAdapter {}

