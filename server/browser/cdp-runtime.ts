import {
  BrowserRuntime,
  BrowserStatus,
  PageObservation,
  BrowserAction,
  ActionResult,
  OutcomeVerification,
  ObservedNode,
  ActionType
} from './runtime-interface.ts';

/**
 * CDP Browser Harness Runtime
 * Connects to local Chrome profile via Chrome DevTools Protocol / Local Agent Bridge.
 * Enforces strictly bounded action space (Jev Pattern), visibility checks, and prevents stale-target mutations.
 * ZERO fake success: honest failures are returned on connection or execution issues.
 */

const PROHIBITED_ACTIONS = new Set([
  'EVALUATE_ARBITRARY_JS',
  'DOWNLOAD_FILE',
  'UPLOAD_FILE',
  'EXECUTE_SHELL',
  'PURCHASE',
  'CHECKOUT',
  'PAYMENT'
]);

export class CdpBrowserRuntime implements BrowserRuntime {
  private cdpEndpoint: string;
  private currentObservation: PageObservation | null = null;
  private connected: boolean = false;

  constructor(cdpEndpoint: string = 'http://127.0.0.1:16881') {
    this.cdpEndpoint = cdpEndpoint;
  }

  public async getStatus(): Promise<BrowserStatus> {
    try {
      const res = await fetch(`${this.cdpEndpoint}/status`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data: any = await res.json();
        this.connected = true;
        return {
          connected: Boolean(data.connected ?? true),
          agentVersion: data.agentVersion || '1.0.0-cdp',
          activeTabUrl: data.activeTabUrl,
          isLoggedIn1688: Boolean(data.isLoggedIn1688),
          humanActionRequired: Boolean(data.humanActionRequired),
          humanActionReason: data.humanActionReason,
          lastHeartbeat: new Date().toISOString()
        };
      }
    } catch {
      this.connected = false;
    }

    return {
      connected: false,
      agentVersion: '1.0.0-cdp',
      isLoggedIn1688: false,
      humanActionRequired: false,
      lastHeartbeat: new Date().toISOString()
    };
  }

  public async navigate(url: string): Promise<{ success: boolean; url: string; error?: string; message?: string }> {
    try {
      const res = await fetch(`${this.cdpEndpoint}/navigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(15000)
      });
      const data: any = await res.json();
      if (!res.ok) {
        return {
          success: false,
          url,
          error: data.error || 'NAVIGATION_FAILED',
          message: data.message || 'Không thể điều hướng tới URL'
        };
      }
      return { success: true, url: data.url || url };
    } catch (err: any) {
      this.connected = false;
      return {
        success: false,
        url,
        error: 'BROWSER_AGENT_UNAVAILABLE',
        message: `Không thể kết nối đến Browser Agent tại ${this.cdpEndpoint}: ${err.message}`
      };
    }
  }

  public async observe(): Promise<PageObservation> {
    try {
      const res = await fetch(`${this.cdpEndpoint}/observe`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const obs: PageObservation = await res.json();
        this.currentObservation = obs;
        return obs;
      }
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    } catch (err: any) {
      this.connected = false;
      const unavailableObs: PageObservation = {
        url: '',
        title: 'Browser Agent Offline',
        observedNodes: [],
        timestamp: new Date().toISOString(),
        isCapturingRiskControl: false,
        isLoggedIn1688: false,
        rawTextExcerpt: `BROWSER_AGENT_UNAVAILABLE: ${err.message}`
      };
      this.currentObservation = unavailableObs;
      return unavailableObs;
    }
  }

  public async execute(action: BrowserAction): Promise<ActionResult> {
    // 1. Enforce Bounded Action Space (Jev Pattern)
    if (PROHIBITED_ACTIONS.has((action.actionType as string).toUpperCase())) {
      return {
        success: false,
        actionExecuted: action.actionType,
        message: `Hành động ${(action.actionType as string)} bị nghiêm cấm trong không gian kiểm soát an toàn (Bounded Action Space).`
      };
    }

    // 2. Fetch fresh DOM observation
    const obs = await this.observe();

    // 3. Stale Target & Occlusion Guards (Independent verification)
    if (action.targetNodeId !== undefined) {
      const targetNode = obs.observedNodes.find(n => n.nodeId === action.targetNodeId);
      if (!targetNode) {
        return {
          success: false,
          actionExecuted: action.actionType,
          targetNodeId: action.targetNodeId,
          staleTargetPrevented: true,
          message: `Stale target rejected: Node ID ${action.targetNodeId} không tồn tại trong snapshot trang hiện tại.`
        };
      }

      if (!targetNode.isVisible) {
        return {
          success: false,
          actionExecuted: action.actionType,
          targetNodeId: action.targetNodeId,
          message: `Node ID ${action.targetNodeId} bị che khuất, ẩn hoặc ngoài tầm nhìn của viewport.`
        };
      }
    }

    if (obs.rawTextExcerpt.startsWith('BROWSER_AGENT_UNAVAILABLE')) {
      return {
        success: false,
        actionExecuted: action.actionType,
        targetNodeId: action.targetNodeId,
        message: 'Thao tác thất bại: Browser Agent cục bộ không khả dụng hoặc mất kết nối.'
      };
    }

    // 4. Dispatch action to local CDP agent
    try {
      const res = await fetch(`${this.cdpEndpoint}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
        signal: AbortSignal.timeout(10000)
      });

      const data: any = await res.json();
      if (!res.ok) {
        return {
          success: false,
          actionExecuted: action.actionType,
          targetNodeId: action.targetNodeId,
          message: data.message || data.error || 'Thực thi hành động thất bại trên trình duyệt'
        };
      }

      return data;
    } catch (err: any) {
      return {
        success: false,
        actionExecuted: action.actionType,
        targetNodeId: action.targetNodeId,
        message: `Lỗi giao tiếp với Browser Agent: ${err.message}`
      };
    }
  }

  public async verifyOutcome(expectedCondition: (obs: PageObservation) => boolean): Promise<OutcomeVerification> {
    const obs = await this.observe();
    const conditionMet = expectedCondition(obs);
    return {
      verified: conditionMet,
      currentUrl: obs.url,
      conditionMet,
      details: conditionMet ? 'Điều kiện trang đã được thỏa mãn' : 'Điều kiện trang chưa đạt kết quả mong muốn'
    };
  }
}
