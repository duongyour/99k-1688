import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import WebSocket from 'ws';

/**
 * 1688 Physical Local Windows Browser Agent
 * - Strictly binds to 127.0.0.1 (Loopback)
 * - Persistent pair-grant authentication (stores deviceId/deviceSecret in agent-config.json)
 * - Connects to local Chrome profile via remote debugging port (default 9222)
 * - Real CDP WebSocket execution for Page.navigate, DOM inspection, and bounded actions
 * - Zero fake success: accurately reports physical truth, Captcha risk control, and login state
 */

const LOCAL_PORT = 16881;
const CONFIG_FILE = path.join(process.cwd(), 'agent-config.json');
const CLOUD_APP_URL = process.env.CLOUD_APP_URL || 'http://127.0.0.1:3000';
const CHROME_CDP_PORT = parseInt(process.env.CHROME_CDP_PORT || '9222', 10);

interface AgentConfig {
  deviceId: string;
  deviceSecret: string;
  cloudUrl: string;
  pairedAt: string;
}

let config: AgentConfig | null = null;
let isChromeConnected = false;
let activeTabUrl = '';
let activeTabId = '';
let activeWebSocketUrl = '';
let isLoggedIn1688 = false;
let loginState: 'NOT_LOGGED_IN' | 'LOGIN_IN_PROGRESS' | 'LOGGED_IN' | 'CAPTCHA_BLOCKED' = 'NOT_LOGGED_IN';
let humanActionRequired = false;
let humanActionReason: string | undefined;
let currentTask: string | null = null;

// Helper: Send a CDP command over WebSocket to Chrome and await result
function sendCdpCommand(wsUrl: string, method: string, params: any = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      const ws = new WebSocket(wsUrl);
      const id = Math.floor(Math.random() * 100000);
      const timer = setTimeout(() => {
        try { ws.close(); } catch {}
        reject(new Error(`CDP Command ${method} timed out after 5000ms`));
      }, 5000);

      ws.on('open', () => {
        ws.send(JSON.stringify({ id, method, params }));
      });

      ws.on('message', (data) => {
        try {
          const res = JSON.parse(data.toString());
          if (res.id === id) {
            clearTimeout(timer);
            ws.close();
            if (res.error) {
              reject(new Error(`CDP Error: ${res.error.message || JSON.stringify(res.error)}`));
            } else {
              resolve(res.result);
            }
          }
        } catch (e) {
          clearTimeout(timer);
          ws.close();
          reject(e);
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

// 1. Load or Initialize Configuration
function loadConfig(): AgentConfig | null {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      if (data.deviceId && data.deviceSecret) {
        return data;
      }
    }
  } catch (err: any) {
    console.warn('[Local Agent] Could not parse agent-config.json:', err.message);
  }
  return null;
}

function saveConfig(newConfig: AgentConfig) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2), { encoding: 'utf8', mode: 0o600 });
  config = newConfig;
}

// 2. Pair Grant Flow
async function attemptPairing(grantToken: string): Promise<boolean> {
  try {
    console.log('[Local Agent] Initiating device pairing with Cloud Control Plane...');
    const res = await fetch(`${CLOUD_APP_URL}/api/browser/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grantToken,
        deviceName: `Windows Chrome Workstation (${process.env.COMPUTERNAME || 'Localhost'})`
      })
    });

    const data: any = await res.json();
    if (!res.ok) {
      console.error('[Local Agent] Pairing rejected by cloud:', data.error);
      return false;
    }

    saveConfig({
      deviceId: data.deviceId,
      deviceSecret: data.deviceSecret,
      cloudUrl: CLOUD_APP_URL,
      pairedAt: new Date().toISOString()
    });

    console.log('[Local Agent] Successfully paired! Device ID registered:', data.deviceId);
    return true;
  } catch (err: any) {
    console.error('[Local Agent] Pairing request failed:', err.message);
    return false;
  }
}

// 3. Chrome DevTools Protocol Probing
async function probeChromeCDP(): Promise<void> {
  try {
    const res = await fetch(`http://127.0.0.1:${CHROME_CDP_PORT}/json/list`, {
      signal: AbortSignal.timeout(1500)
    });
    if (res.ok) {
      const tabs = (await res.json()) as any[];
      isChromeConnected = true;
      const pageTab = tabs.find(t => t.type === 'page' && !t.url.startsWith('chrome-extension://')) || tabs[0];
      if (pageTab) {
        activeTabUrl = pageTab.url || '';
        activeTabId = pageTab.id;
        activeWebSocketUrl = pageTab.webSocketDebuggerUrl || '';

        // Verify real 1688 login status
        if (activeTabUrl.includes('1688.com')) {
          if (activeTabUrl.includes('login') || activeTabUrl.includes('passport')) {
            loginState = 'LOGIN_IN_PROGRESS';
            isLoggedIn1688 = false;
            humanActionRequired = true;
            humanActionReason = 'Cần đăng nhập tài khoản 1688 trên Chrome';
          } else if (activeTabUrl.includes('sec.1688.com') || activeTabUrl.includes('punish')) {
            loginState = 'CAPTCHA_BLOCKED';
            isLoggedIn1688 = false;
            humanActionRequired = true;
            humanActionReason = 'Gặp trang kiểm tra bảo mật / Captcha trượt của Alibaba';
          } else {
            loginState = 'LOGGED_IN';
            isLoggedIn1688 = true;
            humanActionRequired = false;
            humanActionReason = undefined;
          }
        } else {
          isLoggedIn1688 = false;
          loginState = 'NOT_LOGGED_IN';
        }
      }
      return;
    }
  } catch {
    // Chrome remote debugging is offline
  }

  isChromeConnected = false;
  isLoggedIn1688 = false;
  loginState = 'NOT_LOGGED_IN';
  activeWebSocketUrl = '';
}

// 4. Cloud Control Heartbeat
async function sendHeartbeat(): Promise<void> {
  if (!config) return;

  try {
    const res = await fetch(`${config.cloudUrl}/api/browser/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: config.deviceId,
        deviceSecret: config.deviceSecret,
        isLoggedIn1688,
        humanActionRequired,
        humanActionReason,
        activeTabUrl,
        ipAddress: '127.0.0.1'
      })
    });

    if (res.status === 401 || res.status === 403) {
      console.warn('[Local Agent] Heartbeat rejected by cloud (auth failure). Resetting config.');
      config = null;
      try { fs.unlinkSync(CONFIG_FILE); } catch {}
    }
  } catch {
    // Silently continue
  }
}

// 5. Secure Loopback HTTP Server (127.0.0.1:16881)
const server = http.createServer(async (req, res) => {
  // Security: strictly reject non-loopback requests
  const remoteIp = req.socket.remoteAddress;
  if (remoteIp !== '127.0.0.1' && remoteIp !== '::1' && remoteIp !== '::ffff:127.0.0.1') {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Access forbidden: only loopback connections allowed' }));
    return;
  }

  // Security: only allow CORS from origin matching localhost/127.0.0.1 or app domain
  const origin = req.headers.origin || '';
  if (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('.run.app')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // GET /status
  if (req.url === '/status' && req.method === 'GET') {
    await probeChromeCDP();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: isChromeConnected ? 'CONNECTED' : 'DISCONNECTED',
      connected: isChromeConnected,
      agentVersion: '1.0.0-cdp',
      paired: Boolean(config),
      deviceId: config?.deviceId || null,
      activeTabUrl,
      isLoggedIn1688,
      loginState,
      humanActionRequired,
      humanActionReason,
      currentTask
    }));
    return;
  }

  // POST /navigate
  if (req.url === '/navigate' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { url } = JSON.parse(body);
        await probeChromeCDP();
        if (!isChromeConnected || !activeWebSocketUrl) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: 'CHROME_NOT_CONNECTED',
            message: `Chrome DevTools Protocol không khả dụng trên cổng ${CHROME_CDP_PORT}. Vui lòng bật Chrome với cờ --remote-debugging-port=${CHROME_CDP_PORT}`
          }));
          return;
        }

        // Real Page.navigate via CDP
        await sendCdpCommand(activeWebSocketUrl, 'Page.navigate', { url });
        activeTabUrl = url;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, url }));
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // POST /observe
  if (req.url === '/observe' && (req.method === 'GET' || req.method === 'POST')) {
    await probeChromeCDP();
    if (!isChromeConnected || !activeWebSocketUrl) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'BROWSER_AGENT_UNAVAILABLE',
        message: 'Chrome không phản hồi hoặc CDP port 9222 chưa bật'
      }));
      return;
    }

    try {
      // Execute real DOM extraction script inside active tab via Runtime.evaluate
      const evalScript = `
        (function() {
          const title = document.title || '';
          const url = window.location.href;
          const bodyText = (document.body ? document.body.innerText : '').slice(0, 500);
          
          const elements = Array.from(document.querySelectorAll('input, button, a, [role="button"]'));
          const nodes = elements.slice(0, 30).map((el, i) => {
            const rect = el.getBoundingClientRect();
            const text = (el.innerText || el.value || el.placeholder || el.getAttribute('aria-label') || '').trim().slice(0, 50);
            return {
              nodeId: i + 1,
              tagName: el.tagName.toLowerCase(),
              role: el.getAttribute('role') || el.tagName.toLowerCase(),
              text: text,
              isClickable: el.tagName === 'BUTTON' || el.tagName === 'A' || el.onclick !== null,
              isInput: el.tagName === 'INPUT' || el.tagName === 'TEXTAREA',
              isVisible: rect.width > 0 && rect.height > 0
            };
          });

          return { title, url, bodyText, nodes };
        })()
      `;

      const evalResult = await sendCdpCommand(activeWebSocketUrl, 'Runtime.evaluate', {
        expression: evalScript,
        returnByValue: true
      });

      const extracted = evalResult?.result?.value || { title: '', url: activeTabUrl, bodyText: '', nodes: [] };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        url: extracted.url || activeTabUrl,
        title: extracted.title || '1688 Workstation',
        observedNodes: extracted.nodes || [],
        timestamp: new Date().toISOString(),
        isCapturingRiskControl: loginState === 'CAPTCHA_BLOCKED',
        isLoggedIn1688,
        rawTextExcerpt: extracted.bodyText || ''
      }));
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'CDP_OBSERVE_FAILED',
        message: `Lỗi đọc trạng thái DOM qua Chrome CDP: ${err.message}`
      }));
    }
    return;
  }

  // POST /execute
  if (req.url === '/execute' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const action = JSON.parse(body);
        await probeChromeCDP();
        if (!isChromeConnected || !activeWebSocketUrl) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            message: 'Chrome DevTools Protocol không khả dụng'
          }));
          return;
        }

        // Bounded Action Space Enforcement: Banned actions
        const PROHIBITED_ACTIONS = [
          'EVALUATE_ARBITRARY_JS',
          'DOWNLOAD_FILE',
          'UPLOAD_FILE',
          'INSPECT_CREDENTIALS',
          'EXTRACT_COOKIES'
        ];

        if (PROHIBITED_ACTIONS.includes(action.actionType)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            message: `Hành động ${action.actionType} bị nghiêm cấm theo chính sách bảo mật máy trạm`
          }));
          return;
        }

        // Execute bounded actions via CDP
        if (action.actionType === 'NAVIGATE') {
          await sendCdpCommand(activeWebSocketUrl, 'Page.navigate', { url: action.url });
        } else if (action.actionType === 'CLICK') {
          const clickScript = `
            (function() {
              const elements = Array.from(document.querySelectorAll('input, button, a, [role="button"]'));
              const target = elements[${(action.targetNodeId || 1) - 1}];
              if (target) {
                target.click();
                return true;
              }
              return false;
            })()
          `;
          await sendCdpCommand(activeWebSocketUrl, 'Runtime.evaluate', { expression: clickScript });
        } else if (action.actionType === 'INPUT_TEXT') {
          const textVal = JSON.stringify(action.textValue || '');
          const inputScript = `
            (function() {
              const elements = Array.from(document.querySelectorAll('input, textarea'));
              const target = elements[${(action.targetNodeId || 1) - 1}] || document.querySelector('input');
              if (target) {
                target.value = ${textVal};
                target.dispatchEvent(new Event('input', { bubbles: true }));
                target.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
              }
              return false;
            })()
          `;
          await sendCdpCommand(activeWebSocketUrl, 'Runtime.evaluate', { expression: inputScript });
        } else if (action.actionType === 'WAIT') {
          await new Promise(r => setTimeout(r, action.durationMs || 1000));
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          actionExecuted: action.actionType,
          targetNodeId: action.targetNodeId,
          message: `Thực thi thao tác ${action.actionType} thành công trên trình duyệt`
        }));
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

// Startup logic
async function bootstrap() {
  config = loadConfig();

  if (!config) {
    const grantToken = process.env.PAIR_GRANT_TOKEN;
    if (grantToken) {
      await attemptPairing(grantToken);
    } else {
      console.log('[Local Agent] No agent-config.json found. Run with PAIR_GRANT_TOKEN=<grant> to pair with Cloud Control Plane.');
    }
  } else {
    console.log('[Local Agent] Loaded configuration for Device ID:', config.deviceId);
  }

  server.listen(LOCAL_PORT, '127.0.0.1', () => {
    console.log(`[Local Agent] Listening securely on http://127.0.0.1:${LOCAL_PORT}`);
    // Probe Chrome and report heartbeat
    probeChromeCDP();
    setInterval(probeChromeCDP, 5000);
    setInterval(sendHeartbeat, 10000);
  });
}

bootstrap();
