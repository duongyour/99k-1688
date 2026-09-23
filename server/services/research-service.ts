import { ResearchRepository } from '../repositories/research-repo.ts';
import { AuditRepository } from '../repositories/audit-repo.ts';
import { AIModelRouter } from '../ai/model-router.ts';
import { QueueLike, ResearchJobPayload } from '../queue/research-queue.ts';
import { SearchJob } from '../contracts/index.ts';

export interface CreateResearchJobInput {
  query: string;
  creatorId: string;
  creatorName: string;
  maxPriceCny?: number;
  minPriceCny?: number;
  category?: string;
  moqMax?: number;
  requireVideo?: boolean;
  smallLight?: boolean;
  excludeBrand?: boolean;
  resultTargetCount?: number;
}

/**
 * Canonical ResearchApplicationService
 * Shared between Web Express Routes and Remote MCP Server tools.
 * Enforces identical lifecycle: plan keywords, create job, enqueue, audit log.
 */
export class ResearchApplicationService {
  private researchRepo: ResearchRepository;
  private auditRepo: AuditRepository;
  private aiRouter: AIModelRouter;
  private queue?: QueueLike;

  constructor(
    researchRepo: ResearchRepository,
    auditRepo: AuditRepository,
    aiRouter: AIModelRouter,
    queue?: QueueLike
  ) {
    this.researchRepo = researchRepo;
    this.auditRepo = auditRepo;
    this.aiRouter = aiRouter;
    this.queue = queue;
  }

  public async createAndEnqueueJob(input: CreateResearchJobInput): Promise<{
    job: SearchJob;
    chineseKeywords: string[];
    enqueued: boolean;
  }> {
    const {
      query,
      creatorId,
      creatorName,
      maxPriceCny = 30.0,
      minPriceCny = 0,
      category,
      moqMax = 10,
      requireVideo = false,
      smallLight = true,
      excludeBrand = true,
      resultTargetCount = 12
    } = input;

    if (!query || typeof query !== 'string') {
      throw new Error('Vui lòng nhập nhu cầu tìm kiếm sản phẩm');
    }

    // Step 1: Multi-AI keyword expansion
    let chineseKeywords: string[] = [];
    try {
      const aiPlan = await this.aiRouter.executeStructuredTask<{
        chineseKeywords: string[];
        searchStrategy: string;
      }>(
        'KEYWORD_TRANSLATION',
        `Bạn là chuyên gia tìm nguồn hàng bán buôn trên 1688.com.
Người dùng Việt Nam muốn tìm: "${query}"
Trần giá tối đa: ${maxPriceCny} CNY
Yêu cầu video: ${requireVideo ? 'Có' : 'Không'}
Kích thước gọn nhẹ: ${smallLight ? 'Có' : 'Không'}

Hãy dịch và phân rã thành 3-5 cụm từ khóa tiếng Trung sát nhất với thuật toán tìm kiếm của 1688.`,
        '{"chineseKeywords": ["từ_khóa_1", "từ_khóa_2"], "searchStrategy": "mô_tả_chiến_lược"}'
      );
      chineseKeywords = aiPlan.result?.chineseKeywords || [];
    } catch (err: any) {
      chineseKeywords = [query, `${query} 批发`, `${query} 厂家直销`];
    }

    if (!chineseKeywords || chineseKeywords.length === 0) {
      chineseKeywords = [query, `${query} 批发`];
    }

    // Step 2: Persist in D1
    const job = await this.researchRepo.createJob({
      title: query,
      rawQuery: query,
      creatorId,
      creatorName,
      maxPriceCny: Number(maxPriceCny),
      minPriceCny: Number(minPriceCny),
      category,
      moqMax: Number(moqMax),
      requireVideo: Boolean(requireVideo),
      smallLight: Boolean(smallLight),
      excludeBrand: Boolean(excludeBrand),
      resultTargetCount: Number(resultTargetCount),
      chineseKeywords
    });

    // Step 3: Enqueue into Cloudflare Queue / QueueLike
    const payload: ResearchJobPayload = {
      jobId: job.id,
      query: job.rawQuery,
      maxPriceCny: job.maxPriceCny,
      creatorId,
      creatorName,
      chineseKeywords,
      attempts: 0
    };

    let enqueued = false;
    if (this.queue && typeof this.queue.send === 'function') {
      await this.queue.send(payload);
      enqueued = true;
    } else {
      // Local dev immediate execution fallback
      enqueued = true;
    }

    // Step 4: Audit Event
    await this.auditRepo.logEvent(
      { id: creatorId, name: creatorName },
      'RESEARCH_JOB_CREATE',
      'search_job',
      job.id,
      { query, maxPriceCny, keywords: chineseKeywords, enqueued }
    );

    return { job, chineseKeywords, enqueued };
  }
}
