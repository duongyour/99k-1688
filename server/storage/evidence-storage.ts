import crypto from 'crypto';
import { D1Database } from '../db/d1-interface.ts';

export interface R2BucketLike {
  put(key: string, value: any, options?: any): Promise<any>;
  get(key: string): Promise<any>;
  delete(key: string): Promise<any>;
}

export interface StoredEvidence {
  id: string;
  jobId?: string;
  productId?: string;
  r2Key: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  metadata: Record<string, any>;
  createdAt: string;
}

/**
 * Cloudflare R2 Evidence Storage Service
 * Persists raw browser HTML snapshots, network traces, and media artifacts.
 * Records strict SHA-256 cryptographic provenance in D1 evidence_objects table.
 */
export class EvidenceStorageService {
  private db: D1Database;
  private bucket?: R2BucketLike;
  private localFallbackStore = new Map<string, Buffer>();

  constructor(db: D1Database, bucket?: R2BucketLike) {
    this.db = db;
    this.bucket = bucket;
  }

  public async storeEvidence(params: {
    jobId?: string;
    productId?: string;
    contentType: string;
    data: Buffer | string;
    metadata?: Record<string, any>;
  }): Promise<StoredEvidence> {
    const buffer = typeof params.data === 'string' ? Buffer.from(params.data, 'utf8') : params.data;
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const sizeBytes = buffer.byteLength;
    const evidenceId = `evi_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const r2Key = `evidence/${params.jobId || 'general'}/${evidenceId}_${sha256.slice(0, 12)}.${params.contentType.includes('html') ? 'html' : 'json'}`;
    const now = new Date().toISOString();

    // 1. Write to R2 bucket if available, else local fallback
    if (this.bucket) {
      await this.bucket.put(r2Key, buffer, {
        httpMetadata: { contentType: params.contentType },
        customMetadata: {
          sha256,
          evidenceId,
          jobId: params.jobId || '',
          productId: params.productId || ''
        }
      });
    } else {
      this.localFallbackStore.set(r2Key, buffer);
    }

    // 2. Persist record in D1
    await this.db.prepare(
      `INSERT INTO evidence_objects (
        id, job_id, product_id, r2_key, content_type, size_bytes, sha256, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      evidenceId, params.jobId || null, params.productId || null,
      r2Key, params.contentType, sizeBytes, sha256,
      JSON.stringify(params.metadata || {}), now
    ).run();

    return {
      id: evidenceId,
      jobId: params.jobId,
      productId: params.productId,
      r2Key,
      contentType: params.contentType,
      sizeBytes,
      sha256,
      metadata: params.metadata || {},
      createdAt: now
    };
  }

  public async getEvidence(r2Key: string): Promise<Buffer | null> {
    if (this.bucket) {
      const obj = await this.bucket.get(r2Key);
      if (!obj) return null;
      const arrayBuffer = await obj.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }
    return this.localFallbackStore.get(r2Key) || null;
  }
}
