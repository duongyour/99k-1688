import { D1Database } from '../db/d1-interface.ts';
import { SearchJob, JobStatus, Product, Supplier, AiAssessment, PriceStatus, ResearchState } from '../contracts/index.ts';

export class ResearchRepository {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  public async createJob(params: {
    title: string;
    rawQuery: string;
    creatorId: string;
    creatorName: string;
    maxPriceCny: number;
    minPriceCny?: number;
    category?: string;
    moqMax?: number;
    requireVideo?: boolean;
    smallLight?: boolean;
    excludeBrand?: boolean;
    resultTargetCount?: number;
    chineseKeywords?: string[];
  }): Promise<SearchJob> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    const job: SearchJob = {
      id: jobId,
      title: params.title,
      rawQuery: params.rawQuery,
      creatorId: params.creatorId,
      creatorName: params.creatorName,
      status: 'PENDING',
      maxPriceCny: params.maxPriceCny,
      minPriceCny: params.minPriceCny || 0,
      category: params.category,
      moqMax: params.moqMax,
      requireVideo: Boolean(params.requireVideo),
      smallLight: params.smallLight !== false,
      excludeBrand: params.excludeBrand !== false,
      resultTargetCount: params.resultTargetCount || 12,
      chineseKeywords: params.chineseKeywords || [],
      totalCandidates: 0,
      verifiedCandidates: 0,
      rejectedCandidates: 0,
      humanActionRequired: false,
      createdAt: now,
      updatedAt: now
    };

    await this.db.prepare(
      `INSERT INTO search_jobs (
        id, title, raw_query, creator_id, creator_name, status,
        max_price_cny, min_price_cny, category, moq_max, require_video,
        small_light, exclude_brand, result_target_count, chinese_keywords,
        total_candidates, verified_candidates, rejected_candidates,
        human_action_required, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      job.id, job.title, job.rawQuery, job.creatorId, job.creatorName, job.status,
      job.maxPriceCny, job.minPriceCny, job.category || null, job.moqMax || null,
      job.requireVideo ? 1 : 0, job.smallLight ? 1 : 0, job.excludeBrand ? 1 : 0,
      job.resultTargetCount, JSON.stringify(job.chineseKeywords),
      job.totalCandidates, job.verifiedCandidates, job.rejectedCandidates,
      job.humanActionRequired ? 1 : 0, job.createdAt, job.updatedAt
    ).run();

    return job;
  }

  public async getJobById(jobId: string): Promise<SearchJob | null> {
    const row = await this.db.prepare(`SELECT * FROM search_jobs WHERE id = ?`).bind(jobId).first<any>();
    if (!row) return null;

    return {
      id: row.id,
      title: row.title,
      rawQuery: row.raw_query,
      creatorId: row.creator_id,
      creatorName: row.creator_name,
      status: row.status as JobStatus,
      maxPriceCny: row.max_price_cny,
      minPriceCny: row.min_price_cny,
      category: row.category,
      moqMax: row.moq_max,
      requireVideo: Boolean(row.require_video),
      smallLight: Boolean(row.small_light),
      excludeBrand: Boolean(row.exclude_brand),
      resultTargetCount: row.result_target_count,
      chineseKeywords: typeof row.chinese_keywords === 'string' ? JSON.parse(row.chinese_keywords) : (row.chinese_keywords || []),
      totalCandidates: row.total_candidates,
      verifiedCandidates: row.verified_candidates,
      rejectedCandidates: row.rejected_candidates,
      humanActionRequired: Boolean(row.human_action_required),
      errorMessage: row.error_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  public async listJobs(): Promise<SearchJob[]> {
    const rows = await this.db.prepare(`SELECT * FROM search_jobs ORDER BY created_at DESC`).all<any>();
    return (rows.results || []).map(row => ({
      id: row.id,
      title: row.title,
      rawQuery: row.raw_query,
      creatorId: row.creator_id,
      creatorName: row.creator_name,
      status: row.status as JobStatus,
      maxPriceCny: row.max_price_cny,
      minPriceCny: row.min_price_cny,
      category: row.category,
      moqMax: row.moq_max,
      requireVideo: Boolean(row.require_video),
      smallLight: Boolean(row.small_light),
      excludeBrand: Boolean(row.exclude_brand),
      resultTargetCount: row.result_target_count,
      chineseKeywords: typeof row.chinese_keywords === 'string' ? JSON.parse(row.chinese_keywords) : (row.chinese_keywords || []),
      totalCandidates: row.total_candidates,
      verifiedCandidates: row.verified_candidates,
      rejectedCandidates: row.rejected_candidates,
      humanActionRequired: Boolean(row.human_action_required),
      errorMessage: row.error_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  public async updateJobStatus(jobId: string, status: JobStatus, extra?: {
    errorMessage?: string;
    humanActionRequired?: boolean;
    totalCandidates?: number;
    verifiedCandidates?: number;
    rejectedCandidates?: number;
  }): Promise<void> {
    const now = new Date().toISOString();
    await this.db.prepare(
      `UPDATE search_jobs SET
         status = ?,
         error_message = COALESCE(?, error_message),
         human_action_required = COALESCE(?, human_action_required),
         total_candidates = COALESCE(?, total_candidates),
         verified_candidates = COALESCE(?, verified_candidates),
         rejected_candidates = COALESCE(?, rejected_candidates),
         updated_at = ?
       WHERE id = ?`
    ).bind(
      status,
      extra?.errorMessage || null,
      extra?.humanActionRequired !== undefined ? (extra.humanActionRequired ? 1 : 0) : null,
      extra?.totalCandidates ?? null,
      extra?.verifiedCandidates ?? null,
      extra?.rejectedCandidates ?? null,
      now,
      jobId
    ).run();
  }

  public async saveProductEvidence(product: Product, supplier?: Supplier, assessment?: AiAssessment): Promise<void> {
    const now = new Date().toISOString();

    // Save supplier if provided
    if (supplier) {
      await this.db.prepare(
        `INSERT OR REPLACE INTO suppliers (
          id, canonical_supplier_id, name, source_url, location,
          factory_signals, rating_score, years_on_platform, captured_products_count,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        supplier.id, supplier.canonicalSupplierId, supplier.name, supplier.sourceUrl,
        supplier.location || null, supplier.factorySignals || null, supplier.ratingScore || null,
        supplier.yearsOnPlatform || null, supplier.capturedProductsCount || 1, now, now
      ).run();
    }

    // Save product
    await this.db.prepare(
      `INSERT OR REPLACE INTO products (
        id, canonical_1688_id, title, title_zh, source_url, main_image,
        price_displayed_min, price_displayed_max, verified_variant_price,
        price_status, moq, supplier_id, supplier_name, category, weight_kg,
        has_video, video_url, raw_snapshot_reference, research_state,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      product.id, product.canonical1688Id, product.title, product.titleZh, product.sourceUrl, product.mainImage,
      product.priceDisplayedMin, product.priceDisplayedMax, product.verifiedVariantPrice,
      product.priceStatus, product.moq, product.supplierId || null, product.supplierName,
      product.category || null, product.weightKg || null, product.hasVideo ? 1 : 0,
      product.videoUrl || null, product.rawSnapshotReference || null, product.researchState,
      now, now
    ).run();

    // Save variants
    if (product.variants && product.variants.length > 0) {
      for (const v of product.variants) {
        await this.db.prepare(
          `INSERT OR REPLACE INTO product_variants (
            id, product_id, sku_id, name, name_zh, price_cny, is_accessory, is_main_product, image_url, stock
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          v.id, product.id, v.skuId, v.name, v.nameZh, v.priceCny,
          v.isAccessory ? 1 : 0, v.isMainProduct ? 1 : 0, v.imageUrl || null, v.stock || null
        ).run();
      }
    }

    // Save AI assessment if provided
    if (assessment) {
      await this.db.prepare(
        `INSERT OR REPLACE INTO ai_assessments (
          id, product_id, job_id, hook_clarity, demonstrability, before_after_potential,
          problem_solution_strength, novelty_curiosity, visual_media_quality, small_light_suitability,
          retail_headroom_hypothesis, return_support_risk, brand_ip_risk,
          strengths_json, risks_json, unknowns_json, recommendation_status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        assessment.id, product.id, assessment.jobId || null,
        assessment.hookClarity, assessment.demonstrability, assessment.beforeAfterPotential,
        assessment.problemSolutionStrength, assessment.noveltyCuriosity, assessment.visualMediaQuality,
        assessment.smallLightSuitability, assessment.retailHeadroomHypothesis, assessment.returnSupportRisk,
        assessment.brandIpRisk, JSON.stringify(assessment.strengths), JSON.stringify(assessment.risks),
        JSON.stringify(assessment.unknowns), assessment.recommendationStatus, now
      ).run();
    }
  }

  public async getProductById(productId: string): Promise<Product | null> {
    const row = await this.db.prepare(`SELECT * FROM products WHERE id = ?`).bind(productId).first<any>();
    if (!row) return null;

    const variantsRes = await this.db.prepare(`SELECT * FROM product_variants WHERE product_id = ?`).bind(productId).all<any>();
    const assessmentRes = await this.db.prepare(`SELECT * FROM ai_assessments WHERE product_id = ?`).bind(productId).first<any>();
    const supplierRes = row.supplier_id ? await this.db.prepare(`SELECT * FROM suppliers WHERE id = ?`).bind(row.supplier_id).first<any>() : null;

    return {
      id: row.id,
      canonical1688Id: row.canonical_1688_id,
      title: row.title,
      titleZh: row.title_zh,
      sourceUrl: row.source_url,
      mainImage: row.main_image,
      priceDisplayedMin: row.price_displayed_min,
      priceDisplayedMax: row.price_displayed_max,
      verifiedVariantPrice: row.verified_variant_price,
      priceStatus: row.price_status as PriceStatus,
      moq: row.moq,
      supplierId: row.supplier_id,
      supplierName: row.supplier_name,
      supplier: supplierRes ? {
        id: supplierRes.id,
        canonicalSupplierId: supplierRes.canonical_supplier_id,
        name: supplierRes.name,
        sourceUrl: supplierRes.source_url,
        location: supplierRes.location,
        factorySignals: supplierRes.factory_signals,
        ratingScore: supplierRes.rating_score,
        yearsOnPlatform: supplierRes.years_on_platform,
        capturedProductsCount: supplierRes.captured_products_count,
        createdAt: supplierRes.created_at,
        updatedAt: supplierRes.updated_at
      } : undefined,
      category: row.category,
      weightKg: row.weight_kg,
      hasVideo: Boolean(row.has_video),
      videoUrl: row.video_url,
      rawSnapshotReference: row.raw_snapshot_reference,
      researchState: row.research_state as ResearchState,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      variants: (variantsRes.results || []).map(v => ({
        id: v.id,
        productId: v.product_id,
        skuId: v.sku_id,
        name: v.name,
        nameZh: v.name_zh,
        priceCny: v.price_cny,
        isAccessory: Boolean(v.is_accessory),
        isMainProduct: Boolean(v.is_main_product),
        imageUrl: v.image_url,
        stock: v.stock
      })),
      assessment: assessmentRes ? {
        id: assessmentRes.id,
        productId: assessmentRes.product_id,
        jobId: assessmentRes.job_id,
        hookClarity: assessmentRes.hook_clarity,
        demonstrability: assessmentRes.demonstrability,
        beforeAfterPotential: assessmentRes.before_after_potential,
        problemSolutionStrength: assessmentRes.problem_solution_strength,
        noveltyCuriosity: assessmentRes.novelty_curiosity,
        visualMediaQuality: assessmentRes.visual_media_quality,
        smallLightSuitability: assessmentRes.small_light_suitability,
        retailHeadroomHypothesis: assessmentRes.retail_headroom_hypothesis,
        returnSupportRisk: assessmentRes.return_support_risk,
        brandIpRisk: assessmentRes.brand_ip_risk,
        strengths: JSON.parse(assessmentRes.strengths_json || '[]'),
        risks: JSON.parse(assessmentRes.risks_json || '[]'),
        unknowns: JSON.parse(assessmentRes.unknowns_json || '[]'),
        recommendationStatus: assessmentRes.recommendation_status,
        createdAt: assessmentRes.created_at
      } : undefined
    };
  }

  public async listProducts(filterState?: ResearchState): Promise<Product[]> {
    let query = `SELECT id FROM products ORDER BY created_at DESC`;
    let rowsRes;
    if (filterState) {
      rowsRes = await this.db.prepare(`SELECT id FROM products WHERE research_state = ? ORDER BY created_at DESC`).bind(filterState).all<any>();
    } else {
      rowsRes = await this.db.prepare(query).all<any>();
    }

    const products: Product[] = [];
    for (const r of rowsRes.results || []) {
      const p = await this.getProductById(r.id);
      if (p) products.push(p);
    }
    return products;
  }

  public async updateProductState(productId: string, state: ResearchState): Promise<void> {
    const now = new Date().toISOString();
    await this.db.prepare(`UPDATE products SET research_state = ?, updated_at = ? WHERE id = ?`).bind(state, now, productId).run();
  }

  // Suppliers
  public async listSuppliers(): Promise<Supplier[]> {
    const rows = await this.db.prepare(`SELECT * FROM suppliers ORDER BY rating_score DESC, years_on_platform DESC`).all<any>();
    return (rows.results || []).map(r => ({
      id: r.id,
      canonicalSupplierId: r.canonical_supplier_id,
      name: r.name,
      sourceUrl: r.source_url,
      location: r.location,
      factorySignals: r.factory_signals,
      ratingScore: r.rating_score,
      yearsOnPlatform: r.years_on_platform,
      capturedProductsCount: r.captured_products_count,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  public async getSupplierById(supplierId: string): Promise<{ supplier: Supplier; products: Product[] } | null> {
    const row = await this.db.prepare(`SELECT * FROM suppliers WHERE id = ?`).bind(supplierId).first<any>();
    if (!row) return null;

    const supplier: Supplier = {
      id: row.id,
      canonicalSupplierId: row.canonical_supplier_id,
      name: row.name,
      sourceUrl: row.source_url,
      location: row.location,
      factorySignals: row.factory_signals,
      ratingScore: row.rating_score,
      yearsOnPlatform: row.years_on_platform,
      capturedProductsCount: row.captured_products_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };

    const productRows = await this.db.prepare(`SELECT id FROM products WHERE supplier_id = ?`).bind(supplierId).all<any>();
    const products: Product[] = [];
    for (const pr of productRows.results || []) {
      const p = await this.getProductById(pr.id);
      if (p) products.push(p);
    }

    return { supplier, products };
  }

  // Product Media (Studio Cleanup)
  public async addProductMedia(productId: string, media: {
    type: 'IMAGE' | 'VIDEO';
    originalUrl: string;
    cleanedUrl?: string;
    tags?: string[];
  }): Promise<any> {
    const mediaId = `med_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    await this.db.prepare(
      `INSERT INTO product_media (
        id, product_id, type, original_url, cleaned_url, tags_json, is_active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
    ).bind(
      mediaId, productId, media.type, media.originalUrl,
      media.cleanedUrl || null, JSON.stringify(media.tags || ['STUDIO_CLEANED']), now
    ).run();

    return {
      id: mediaId,
      productId,
      type: media.type,
      originalUrl: media.originalUrl,
      cleanedUrl: media.cleanedUrl,
      tags: media.tags || ['STUDIO_CLEANED'],
      createdAt: now
    };
  }

  // Shortlists
  public async listShortlists(userId?: string): Promise<any[]> {
    let rows;
    if (userId) {
      rows = await this.db.prepare(`SELECT * FROM shortlists WHERE user_id = ? ORDER BY updated_at DESC`).bind(userId).all<any>();
    } else {
      rows = await this.db.prepare(`SELECT * FROM shortlists ORDER BY updated_at DESC`).all<any>();
    }
    return rows.results || [];
  }

  public async getShortlistById(shortlistId: string): Promise<any | null> {
    const row = await this.db.prepare(`SELECT * FROM shortlists WHERE id = ?`).bind(shortlistId).first<any>();
    if (!row) return null;

    const itemsRows = await this.db.prepare(`SELECT * FROM shortlist_items WHERE shortlist_id = ? ORDER BY added_at DESC`).bind(shortlistId).all<any>();
    const items: any[] = [];
    for (const ir of itemsRows.results || []) {
      const product = await this.getProductById(ir.product_id);
      items.push({
        id: ir.id,
        shortlistId: ir.shortlist_id,
        productId: ir.product_id,
        notes: ir.notes,
        addedAt: ir.added_at,
        product
      });
    }

    return {
      shortlist: row,
      items
    };
  }

  public async createShortlist(params: { name: string; description?: string; userId: string; userName: string }): Promise<any> {
    const id = `shl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    await this.db.prepare(
      `INSERT INTO shortlists (id, name, description, user_id, user_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, params.name, params.description || null, params.userId, params.userName, now, now).run();

    return { id, name: params.name, description: params.description, userId: params.userId, userName: params.userName, createdAt: now, updatedAt: now };
  }

  public async deleteShortlist(shortlistId: string): Promise<void> {
    await this.db.batch([
      this.db.prepare(`DELETE FROM shortlist_items WHERE shortlist_id = ?`).bind(shortlistId),
      this.db.prepare(`DELETE FROM shortlists WHERE id = ?`).bind(shortlistId)
    ]);
  }

  public async addShortlistItem(shortlistId: string, productId: string, notes?: string): Promise<any> {
    const id = `shi_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    await this.db.prepare(
      `INSERT OR REPLACE INTO shortlist_items (id, shortlist_id, product_id, notes, added_at)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(id, shortlistId, productId, notes || null, now).run();

    await this.db.prepare(`UPDATE shortlists SET updated_at = ? WHERE id = ?`).bind(now, shortlistId).run();

    return { id, shortlistId, productId, notes, addedAt: now };
  }

  public async removeShortlistItem(shortlistId: string, itemId: string): Promise<void> {
    await this.db.prepare(`DELETE FROM shortlist_items WHERE id = ? AND shortlist_id = ?`).bind(itemId, shortlistId).run();
  }
}
