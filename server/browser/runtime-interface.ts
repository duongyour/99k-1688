/**
 * Canonical Browser Runtime Interface
 * Adapted from browser-use/jev-ultrafast design principles:
 * - Strictly bounded action space (no arbitrary CSS/XPath/JS execution)
 * - Observed node identity validation
 * - Stale-page guards before mutation
 * - Independent outcome verification
 */

export type ActionType =
  | 'CLICK'
  | 'TYPE_TEXT'
  | 'SELECT'
  | 'SCROLL_UP'
  | 'SCROLL_DOWN'
  | 'WAIT'
  | 'DONE'
  | 'BLOCKED';

export interface ObservedNode {
  nodeId: number;
  tagName: string;
  role?: string;
  text?: string;
  bounds?: { x: number; y: number; width: number; height: number };
  isClickable: boolean;
  isInput: boolean;
  isVisible: boolean;
}

export interface PageObservation {
  url: string;
  title: string;
  observedNodes: ObservedNode[];
  timestamp: string;
  isCapturingRiskControl: boolean;
  isLoggedIn1688: boolean;
  rawTextExcerpt: string;
}

export interface BrowserAction {
  actionType: ActionType;
  targetNodeId?: number;
  inputValue?: string;
  scrollAmount?: number;
}

export interface ActionResult {
  success: boolean;
  actionExecuted: ActionType;
  targetNodeId?: number;
  message?: string;
  staleTargetPrevented?: boolean;
}

export interface OutcomeVerification {
  verified: boolean;
  currentUrl: string;
  conditionMet: boolean;
  details?: string;
}

export interface BrowserStatus {
  connected: boolean;
  agentVersion: string;
  activeTabUrl?: string;
  isLoggedIn1688: boolean;
  humanActionRequired: boolean;
  humanActionReason?: string;
  lastHeartbeat: string;
}

export interface BrowserRuntime {
  getStatus(): Promise<BrowserStatus>;
  navigate(url: string): Promise<{ success: boolean; url: string }>;
  observe(): Promise<PageObservation>;
  execute(action: BrowserAction): Promise<ActionResult>;
  verifyOutcome(expectedCondition: (obs: PageObservation) => boolean): Promise<OutcomeVerification>;
}
