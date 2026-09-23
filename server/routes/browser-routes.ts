import { Router, Request, Response } from 'express';
import { BrowserRepository } from '../repositories/browser-repo.ts';
import { AuditRepository } from '../repositories/audit-repo.ts';
import { requireAuth, requirePermission } from '../auth/middleware.ts';

export function createBrowserRouter(
  browserRepo: BrowserRepository,
  auditRepo: AuditRepository
) {
  const router = Router();

  // Public/Agent endpoints for pairing & heartbeat
  router.post('/pair', async (req: Request, res: Response) => {
    try {
      const { grantToken, deviceName = 'Máy trạm nghiên cứu 1688', ipAddress } = req.body;

      if (!grantToken) {
        return res.status(400).json({ error: 'Mã ghép nối (grantToken) là bắt buộc' });
      }

      const clientIp = ipAddress || req.ip || '127.0.0.1';
      const result = await browserRepo.pairDeviceWithGrant(grantToken, deviceName, clientIp);

      await auditRepo.logEvent(
        { name: 'LOCAL_BROWSER_AGENT' },
        'BROWSER_DEVICE_PAIRED',
        'browser_device',
        result.deviceId,
        { deviceName, ipAddress: clientIp }
      );

      return res.json({
        success: true,
        deviceId: result.deviceId,
        deviceSecret: result.deviceSecret,
        message: 'Ghép nối máy trạm Chrome CDP thành công'
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.post('/heartbeat', async (req: Request, res: Response) => {
    try {
      const {
        deviceId,
        deviceSecret,
        isLoggedIn1688,
        humanActionRequired,
        humanActionReason,
        currentTask,
        ipAddress
      } = req.body;

      if (!deviceId || !deviceSecret) {
        return res.status(401).json({ error: 'Xác thực thiết bị bắt buộc (deviceId & deviceSecret)' });
      }

      await browserRepo.recordHeartbeat({
        deviceId,
        deviceSecret,
        isLoggedIn1688: Boolean(isLoggedIn1688),
        humanActionRequired: Boolean(humanActionRequired),
        humanActionReason,
        currentTask,
        ipAddress: ipAddress || req.ip
      });

      return res.json({ success: true, timestamp: new Date().toISOString() });
    } catch (err: any) {
      return res.status(401).json({ error: err.message });
    }
  });

  router.post('/ping', async (req: Request, res: Response) => {
    return res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Authenticated user endpoints
  router.get('/status', requireAuth, requirePermission('browser.view'), async (req: Request, res: Response) => {
    try {
      const activeDevice = await browserRepo.getActiveDevice();
      const allDevices = await browserRepo.listDevices();

      return res.json({
        connected: activeDevice ? activeDevice.status === 'CONNECTED' : false,
        device: activeDevice,
        allDevices,
        humanActionRequired: activeDevice ? activeDevice.status === 'HUMAN_ACTION_REQUIRED' : false,
        humanActionReason: activeDevice?.humanActionReason,
        isLoggedIn1688: activeDevice?.isLoggedIn1688 ?? false
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post('/pair-grant', requireAuth, requirePermission('browser.manage'), async (req: Request, res: Response) => {
    try {
      const grant = await browserRepo.createPairGrant(req.user!.id);

      await auditRepo.logEvent(
        { id: req.user!.id, name: req.user!.fullName },
        'PAIR_GRANT_CREATE',
        'pair_grant',
        undefined,
        { expiresAt: grant.expiresAt }
      );

      return res.json({
        rawGrant: grant.rawGrant,
        expiresAt: grant.expiresAt,
        message: 'Mã ghép nối có hiệu lực trong 10 phút. Hãy nhập mã này vào Local Agent.'
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
