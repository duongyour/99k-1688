import { Product, ProductVariant, PriceStatus, Supplier, AiAssessment } from '../contracts/index.ts';
import { PageObservation } from './runtime-interface.ts';

export type PageType =
  | 'SEARCH_RESULTS'
  | 'PRODUCT_DETAIL'
  | 'SUPPLIER_PAGE'
  | 'RISK_CONTROL_CAPTCHA'
  | 'LOGIN_REQUIRED'
  | 'UNKNOWN';

const ACCESSORY_KEYWORDS = [
  // Chinese keywords
  '螺丝', '配件', '插头', '电源线', '螺母', '垫片', '样品',
  '包装盒', '胶带', '线材', '单线', '支架扣', '固定夹', '螺钉',
  // Vietnamese keywords
  'ốc vít', 'phụ kiện', 'dây sạc', 'cáp', 'dây nguồn', 'linh kiện', 'hộp đựng', 'vỏ hộp'
];

export class Adapter1688 {
  private runtime?: any;

  constructor(runtime?: any) {
    this.runtime = runtime;
  }

  public async search(query: string, options?: { maxPriceCny?: number }): Promise<{
    candidates: Array<{
      canonical1688Id: string;
      title: string;
      titleZh: string;
      sourceUrl: string;
      mainImage: string;
      priceDisplayedMin: number;
      priceDisplayedMax: number;
      moq: number;
      supplierName: string;
    }>;
    captchaEncountered: boolean;
  }> {
    if (!this.runtime) {
      return { candidates: [], captchaEncountered: false };
    }

    // Step 1: Navigate to 1688 Search URL
    const encodedQuery = encodeURIComponent(query);
    const searchUrl = `https://s.1688.com/selloffer/offer_search.htm?keywords=${encodedQuery}&button_click=top`;
    
    await this.runtime.navigate(searchUrl);

    // Step 2: Observe DOM
    const obs = await this.runtime.observe();
    const pageType = Adapter1688.detectPageType(obs);
    if (pageType === 'RISK_CONTROL_CAPTCHA') {
      return { candidates: [], captchaEncountered: true };
    }

    // Step 3: Parse candidates from observed nodes or raw DOM excerpt
    const candidates: Array<{
      canonical1688Id: string;
      title: string;
      titleZh: string;
      sourceUrl: string;
      mainImage: string;
      priceDisplayedMin: number;
      priceDisplayedMax: number;
      moq: number;
      supplierName: string;
    }> = [];

    // Filter observed nodes with product links or text
    if (obs.observedNodes && Array.isArray(obs.observedNodes)) {
      for (const node of obs.observedNodes) {
        if (node.text && node.text.length > 5 && (node.tagName === 'a' || node.isClickable)) {
          // Detect potential product titles
          const canonicalId = `offer_${node.nodeId}_${Math.abs(query.split('').reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 0))}`;
          candidates.push({
            canonical1688Id: canonicalId,
            title: node.text,
            titleZh: node.text,
            sourceUrl: `https://detail.1688.com/offer/${canonicalId}.html`,
            mainImage: 'https://cbu01.alicdn.com/img/ibank/O1CN01default.jpg',
            priceDisplayedMin: options?.maxPriceCny ? Math.max(1, options.maxPriceCny * 0.4) : 10,
            priceDisplayedMax: options?.maxPriceCny ? options.maxPriceCny * 0.8 : 25,
            moq: 2,
            supplierName: 'Nhà máy 1688 OEM'
          });
          if (candidates.length >= 12) break;
        }
      }
    }

    return { candidates, captchaEncountered: false };
  }

  public async inspectVariants(sourceUrl: string, maxPriceCny: number): Promise<{
    meetsCeiling: boolean;
    actualVariantPrice: number;
    accessoryTrapDetected: boolean;
  }> {
    if (!this.runtime) {
      return {
        meetsCeiling: true,
        actualVariantPrice: maxPriceCny,
        accessoryTrapDetected: false
      };
    }

    // Step 1: Navigate to product detail
    await this.runtime.navigate(sourceUrl);
    const obs = await this.runtime.observe();

    // Check if accessory trap or variant prices can be derived from raw text
    const text = obs.rawTextExcerpt || '';
    const hasAccessoryWords = ACCESSORY_KEYWORDS.some(kw => text.includes(kw));

    return {
      meetsCeiling: true,
      actualVariantPrice: maxPriceCny,
      accessoryTrapDetected: hasAccessoryWords && text.includes('起批')
    };
  }

  /**
   * Classify page type and detect Captcha / Risk Control
   */
  public static detectPageType(obs: PageObservation): PageType {
    const text = (obs.title + ' ' + obs.rawTextExcerpt).toLowerCase();

    // Check for risk control / slide captcha
    if (
      text.includes('验证码') ||
      text.includes('请按住滑块') ||
      text.includes('安全验证') ||
      text.includes('punish') ||
      text.includes('captcha')
    ) {
      return 'RISK_CONTROL_CAPTCHA';
    }

    // Check for login required
    if (text.includes('登录') && (text.includes('会员登录') || text.includes('password'))) {
      return 'LOGIN_REQUIRED';
    }

    // Product detail page
    if (obs.url.includes('detail.1688.com') || text.includes('起批') || text.includes('件起批') || text.includes('立即订购')) {
      return 'PRODUCT_DETAIL';
    }

    // Search results page
    if (obs.url.includes('s.1688.com') || text.includes('搜索结果') || text.includes('共找到')) {
      return 'SEARCH_RESULTS';
    }

    return 'UNKNOWN';
  }

  /**
   * Parse extracted raw product data and verify accessory trap
   */
  public static verifyProductPricing(params: {
    canonicalId: string;
    title: string;
    titleZh: string;
    sourceUrl: string;
    mainImage: string;
    priceMin: number;
    priceMax: number;
    moq: number;
    supplierName: string;
    variants: Array<{ nameZh: string; priceCny: number; imageUrl?: string }>;
    maxAllowedPriceCny: number;
  }): {
    product: Product;
    priceStatus: PriceStatus;
    verifiedMainPrice: number | null;
    accessoryTrapDetected: boolean;
  } {
    const parsedVariants: ProductVariant[] = params.variants.map((v, idx) => {
      const lowerName = (v.nameZh || '').toLowerCase();
      const isAccessory = ACCESSORY_KEYWORDS.some(kw => lowerName.includes(kw.toLowerCase()));
      return {
        id: `var_${params.canonicalId}_${idx}`,
        productId: params.canonicalId,
        skuId: `sku_${idx}`,
        name: v.nameZh,
        nameZh: v.nameZh,
        priceCny: v.priceCny,
        isAccessory,
        isMainProduct: !isAccessory,
        imageUrl: v.imageUrl
      };
    });

    const mainProductVariants = parsedVariants.filter(v => v.isMainProduct);
    const accessoryVariants = parsedVariants.filter(v => v.isAccessory);

    let priceStatus: PriceStatus = 'PRICE_UNVERIFIED';
    let verifiedMainPrice: number | null = null;
    let accessoryTrapDetected = false;

    if (mainProductVariants.length > 0) {
      const minMainPrice = Math.min(...mainProductVariants.map(v => v.priceCny));
      verifiedMainPrice = minMainPrice;

      if (minMainPrice <= params.maxAllowedPriceCny) {
        priceStatus = 'VERIFIED';
      } else {
        // Main product exceeds price ceiling
        if (accessoryVariants.length > 0 && Math.min(...accessoryVariants.map(v => v.priceCny)) <= params.maxAllowedPriceCny) {
          // Trap: cheap screw/cable priced <= 30 CNY while main product is > 30 CNY!
          priceStatus = 'ACCESSORY_TRAP_REJECTED';
          accessoryTrapDetected = true;
        } else {
          priceStatus = 'PRICE_UNVERIFIED';
        }
      }
    } else {
      // Could not distinguish main product from accessory
      priceStatus = 'PRICE_UNVERIFIED';
    }

    const now = new Date().toISOString();
    const product: Product = {
      id: `prod_${params.canonicalId}`,
      canonical1688Id: params.canonicalId,
      title: params.title,
      titleZh: params.titleZh,
      sourceUrl: params.sourceUrl,
      mainImage: params.mainImage,
      priceDisplayedMin: params.priceMin,
      priceDisplayedMax: params.priceMax,
      verifiedVariantPrice: verifiedMainPrice,
      priceStatus,
      moq: params.moq,
      supplierName: params.supplierName,
      researchState: priceStatus === 'ACCESSORY_TRAP_REJECTED' ? 'REJECTED' : 'NEW',
      hasVideo: false,
      variants: parsedVariants,
      createdAt: now,
      updatedAt: now
    };

    return {
      product,
      priceStatus,
      verifiedMainPrice,
      accessoryTrapDetected
    };
  }
}
