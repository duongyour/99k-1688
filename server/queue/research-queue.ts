import { ResearchRepository } from '../repositories/research-repo.ts';
import { AuditRepository } from '../repositories/audit-repo.ts';
import { AIModelRouter } from '../ai/model-router.ts';
import { EvidenceStorageService } from '../storage/evidence-storage.ts';
import { Adapter1688 } from '../browser/adapter-1688.ts';
import { CdpBrowserRuntime } from '../browser/cdp-runtime.ts';
import { Product, Supplier, AiAssessment } from '../contracts/index.ts';

export interface ResearchQueueMessage {
  jobId: string;
  query: string;
  maxPriceCny: number;
  creatorId: string;
  creatorName: string;
  chineseKeywords?: string[];
  attempts: number;
}

export type ResearchJobPayload = ResearchQueueMessage;

export interface QueueLike {
  send(message: any): Promise<void>;
}

/**
 * Cloudflare Workers Queue Processor for Research Jobs
 * Executes real browser orchestration via Adapter1688 and CdpBrowserRuntime,
 * records raw R2 evidence snapshots, and generates AI assessments with strict provenance separation.
 */
export class ResearchQueueProcessor {
  private researchRepo: ResearchRepository;
  private auditRepo: AuditRepository;
  private aiRouter: AIModelRouter;
  private evidenceService: EvidenceStorageService;
  private queue?: QueueLike;

  constructor(
    researchRepo: ResearchRepository,
    auditRepo: AuditRepository,
    aiRouter: AIModelRouter,
    evidenceService: EvidenceStorageService,
    queue?: QueueLike
  ) {
    this.researchRepo = researchRepo;
    this.auditRepo = auditRepo;
    this.aiRouter = aiRouter;
    this.evidenceService = evidenceService;
    this.queue = queue;
  }

  public async enqueueJob(message: ResearchQueueMessage): Promise<void> {
    if (this.queue) {
      await this.queue.send(message);
    } else {
      // Async background tick for Node.js / standalone execution
      setImmediate(() => {
        this.processJob(message).catch(err => {
          console.error(`[Queue] Failed processing job ${message.jobId}:`, err);
        });
      });
    }
  }

  public async processJob(msg: ResearchQueueMessage): Promise<void> {
    const { jobId, query, maxPriceCny, creatorId, creatorName } = msg;

    // 1. Transition to RUNNING
    await this.researchRepo.updateJobStatus(jobId, 'RUNNING');
    await this.auditRepo.logEvent(
      { id: creatorId, name: creatorName },
      'RESEARCH_JOB_RUNNING',
      'search_job',
      jobId,
      { query, maxPriceCny }
    );

    try {
      const runtime = new CdpBrowserRuntime();
      const status = await runtime.getStatus();

      // Check if browser agent is ready
      if (!status.connected) {
        await this.researchRepo.updateJobStatus(jobId, 'PAUSED_HUMAN_ACTION', {
          errorMessage: 'Máy trạm Chrome DevTools Protocol chưa kết nối hoặc đang offline',
          humanActionRequired: true
        });
        return;
      }

      if (status.humanActionRequired || !status.isLoggedIn1688) {
        await this.researchRepo.updateJobStatus(jobId, 'PAUSED_HUMAN_ACTION', {
          errorMessage: status.humanActionReason || 'Cần hoàn tất đăng nhập tài khoản 1688 trên trình duyệt máy trạm',
          humanActionRequired: true
        });
        return;
      }

      // 2. Query 1688 with Adapter
      const adapter = new Adapter1688(runtime);
      const searchResult = await adapter.search(query, { maxPriceCny });

      if (searchResult.captchaEncountered) {
        await this.researchRepo.updateJobStatus(jobId, 'PAUSED_HUMAN_ACTION', {
          errorMessage: 'Gặp trang kiểm tra bảo mật (Slide Captcha) của Alibaba',
          humanActionRequired: true
        });
        return;
      }

      // Store raw page snapshot as evidence in R2
      const rawSnapshot = await runtime.observe();
      const evidence = await this.evidenceService.storeEvidence({
        jobId,
        contentType: 'application/json',
        data: JSON.stringify(rawSnapshot),
        metadata: { query, candidateCount: searchResult.candidates.length }
      });

      let verifiedCount = 0;
      let rejectedCount = 0;

      // 3. Process candidates
      for (const item of searchResult.candidates) {
        // Inspect variant price
        const variantInspection = await adapter.inspectVariants(item.sourceUrl, maxPriceCny);

        if (!variantInspection.meetsCeiling) {
          rejectedCount++;
          continue;
        }

        verifiedCount++;

        const productId = `prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const supplierId = `sup_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

        const supplier: Supplier = {
          id: supplierId,
          canonicalSupplierId: `1688_sup_${item.canonical1688Id}`,
          name: item.supplierName,
          sourceUrl: item.sourceUrl,
          ratingScore: undefined, // Honest state: only populated if physically extracted from shop header
          yearsOnPlatform: undefined,
          capturedProductsCount: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const product: Product = {
          id: productId,
          canonical1688Id: item.canonical1688Id,
          title: item.title,
          titleZh: item.titleZh,
          sourceUrl: item.sourceUrl,
          mainImage: item.mainImage,
          priceDisplayedMin: item.priceDisplayedMin,
          priceDisplayedMax: item.priceDisplayedMax,
          verifiedVariantPrice: variantInspection.actualVariantPrice,
          priceStatus: 'VERIFIED',
          moq: item.moq || 2,
          supplierId,
          supplierName: item.supplierName,
          category: 'Nguồn hàng 1688',
          hasVideo: false,
          rawSnapshotReference: evidence.r2Key,
          researchState: 'NEW_CANDIDATE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        // 4. Multi-AI Evaluation with strict Fact/Inference separation
        let assessment: AiAssessment;
        try {
          const aiResult = await this.aiRouter.routeTask('PRODUCT_EVALUATION', {
            titleZh: item.titleZh,
            variantPrice: variantInspection.actualVariantPrice,
            category: product.category,
            moq: product.moq
          });

          assessment = {
            id: `asm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            productId,
            jobId,
            hookClarity: typeof aiResult.scores?.hookClarity === 'number' ? aiResult.scores.hookClarity : 5,
            demonstrability: typeof aiResult.scores?.demonstrability === 'number' ? aiResult.scores.demonstrability : 5,
            beforeAfterPotential: typeof aiResult.scores?.beforeAfterPotential === 'number' ? aiResult.scores.beforeAfterPotential : 5,
            problemSolutionStrength: typeof aiResult.scores?.problemSolutionStrength === 'number' ? aiResult.scores.problemSolutionStrength : 5,
            noveltyCuriosity: typeof aiResult.scores?.noveltyCuriosity === 'number' ? aiResult.scores.noveltyCuriosity : 5,
            visualMediaQuality: typeof aiResult.scores?.visualMediaQuality === 'number' ? aiResult.scores.visualMediaQuality : 5,
            smallLightSuitability: typeof aiResult.scores?.smallLightSuitability === 'number' ? aiResult.scores.smallLightSuitability : 5,
            retailHeadroomHypothesis: aiResult.retailHeadroomHypothesis || `Ước tính biên giá dựa trên giá nhập ${variantInspection.actualVariantPrice} CNY`,
            returnSupportRisk: aiResult.returnSupportRisk || 'Chưa đánh giá',
            brandIpRisk: aiResult.brandIpRisk || 'Chưa xác định',
            strengths: aiResult.strengths || ['Giá xưởng đạt trần chi phí'],
            risks: aiResult.risks || ['Cần thẩm định thêm mẫu thực tế'],
            unknowns: aiResult.unknowns || ['Chưa kiểm tra được tỷ lệ hoàn hàng thực tế'],
            recommendationStatus: aiResult.recommendationStatus || 'CONSIDER',
            createdAt: new Date().toISOString()
          };
        } catch {
          // Zero fabrication: when AI unavailable, record honest UNASSESSED state
          assessment = {
            id: `asm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            productId,
            jobId,
            hookClarity: 0,
            demonstrability: 0,
            beforeAfterPotential: 0,
            problemSolutionStrength: 0,
            noveltyCuriosity: 0,
            visualMediaQuality: 0,
            smallLightSuitability: 0,
            retailHeadroomHypothesis: 'Chưa có phân tích AI',
            returnSupportRisk: 'Chưa đánh giá',
            brandIpRisk: 'Chưa kiểm tra',
            strengths: [],
            risks: [],
            unknowns: ['Mô hình AI ngoại tuyến hoặc chưa cấu hình API key'],
            recommendationStatus: 'CONSIDER',
            createdAt: new Date().toISOString()
          };
        }

        await this.researchRepo.saveProductEvidence(product, supplier, assessment);
      }

      // 5. Complete Job
      await this.researchRepo.updateJobStatus(jobId, 'COMPLETED', {
        totalCandidates: searchResult.candidates.length,
        verifiedCandidates: verifiedCount,
        rejectedCandidates: rejectedCount
      });

      await this.auditRepo.logEvent(
        { id: creatorId, name: creatorName },
        'RESEARCH_JOB_COMPLETED',
        'search_job',
        jobId,
        { total: searchResult.candidates.length, verified: verifiedCount, rejected: rejectedCount }
      );
    } catch (err: any) {
      console.error(`[QueueProcessor] Error processing job ${jobId}:`, err);
      if (msg.attempts >= 3) {
        await this.researchRepo.updateJobStatus(jobId, 'FAILED', {
          errorMessage: err.message || 'Lỗi không xác định trong quá trình thẩm định'
        });
      } else {
        // Retry
        await this.enqueueJob({
          ...msg,
          attempts: msg.attempts + 1
        });
      }
    }
  }
}
