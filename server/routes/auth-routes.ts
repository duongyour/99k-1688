import { Router, Request, Response } from 'express';
import { UserRepository } from '../repositories/user-repo.ts';
import { SessionRepository } from '../repositories/session-repo.ts';
import { AuditRepository } from '../repositories/audit-repo.ts';
import { hashPassword, verifyPassword, generateSessionToken, hashToken } from '../auth/crypto.ts';
import { requireAuth } from '../auth/middleware.ts';

export function createAuthRouter(
  userRepo: UserRepository,
  sessionRepo: SessionRepository,
  auditRepo: AuditRepository
) {
  const router = Router();

  // Sliding window rate limiter
  const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
  function checkRateLimit(key: string, limit: number = 10, windowMs: number = 60000): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(key);
    if (!entry || entry.resetAt < now) {
      rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (entry.count >= limit) return false;
    entry.count++;
    return true;
  }

  /**
   * POST /api/auth/register
   * Atomic bootstrap: First user atomically becomes OWNER; subsequent users become PENDING_APPROVAL.
   */
  router.post('/register', async (req: Request, res: Response) => {
    try {
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'ip';
      if (!checkRateLimit(`reg_${clientIp}`, 10)) {
        return res.status(429).json({ error: 'Quá nhiều yêu cầu đăng ký. Vui lòng thử lại sau ít phút.' });
      }

      const { email, password, fullName, phone } = req.body;

      if (!email || !password || !fullName || !phone || !phone.trim()) {
        return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ email, mật khẩu, họ tên và số điện thoại' });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ error: 'Định dạng email không hợp lệ' });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: 'Mật khẩu phải có tối thiểu 8 ký tự' });
      }

      const passwordHash = hashPassword(password);
      const { user, isOwner } = await userRepo.atomicRegisterUser({
        email: email.trim().toLowerCase(),
        passwordHash,
        fullName: fullName.trim(),
        phone: phone.trim()
      });

      // Generate session
      const { rawToken, tokenHash } = generateSessionToken();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
      await sessionRepo.createSession(user.id, tokenHash, expiresAt);

      // Audit log
      await auditRepo.logEvent(
        { id: user.id, name: user.fullName },
        isOwner ? 'AUTH_BOOTSTRAP_OWNER' : 'AUTH_REGISTER',
        'user',
        user.id,
        { email: user.email, status: user.status }
      );

      // Set HttpOnly Secure Cookie (Never exposed to client-side JavaScript)
      res.cookie('session_token', rawToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60 * 1000
      });

      return res.json({
        user,
        isOwner,
        message: isOwner
          ? 'Chào mừng! Bạn đã khởi tạo hệ thống thành công với tư cách CHỦ SỞ HỮU (OWNER).'
          : 'Đăng ký thành công. Tài khoản của bạn đang chờ phê duyệt từ Quản trị viên.'
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message || 'Đăng ký thất bại' });
    }
  });

  /**
   * POST /api/auth/login
   */
  router.post('/login', async (req: Request, res: Response) => {
    try {
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'ip';
      if (!checkRateLimit(`login_${clientIp}`, 15)) {
        return res.status(429).json({ error: 'Quá nhiều lần đăng nhập không thành công. Vui lòng đợi 1 phút.' });
      }

      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu' });
      }

      const userWithHash = await userRepo.findByEmail(email.trim().toLowerCase());
      if (!userWithHash) {
        return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });
      }

      const isValid = verifyPassword(password, userWithHash.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });
      }

      if (userWithHash.status === 'REJECTED' || userWithHash.status === 'DEACTIVATED') {
        return res.status(403).json({ error: 'Tài khoản của bạn đã bị từ chối hoặc tạm khóa' });
      }

      const { rawToken, tokenHash } = generateSessionToken();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await sessionRepo.createSession(userWithHash.id, tokenHash, expiresAt);

      await auditRepo.logEvent(
        { id: userWithHash.id, name: userWithHash.fullName },
        'AUTH_LOGIN',
        'user',
        userWithHash.id,
        { email: userWithHash.email }
      );

      res.cookie('session_token', rawToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60 * 1000
      });

      const { passwordHash: _, ...user } = userWithHash;
      return res.json({
        user
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Đăng nhập thất bại' });
    }
  });

  /**
   * POST /api/auth/change-password
   */
  router.post('/change-password', requireAuth, async (req: Request, res: Response) => {
    try {
      const { oldPassword, newPassword } = req.body;
      if (!oldPassword || !newPassword || newPassword.length < 8) {
        return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 8 ký tự' });
      }

      const userWithHash = await userRepo.findByEmail(req.user!.email);
      if (!userWithHash || !verifyPassword(oldPassword, userWithHash.passwordHash)) {
        return res.status(400).json({ error: 'Mật khẩu hiện tại không chính xác' });
      }

      const newHash = hashPassword(newPassword);
      await userRepo.updatePassword(req.user!.id, newHash);

      await auditRepo.logEvent(
        { id: req.user!.id, name: req.user!.fullName },
        'AUTH_CHANGE_PASSWORD',
        'user',
        req.user!.id,
        {}
      );

      return res.json({ success: true, message: 'Đổi mật khẩu thành công' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/auth/logout
   */
  router.post('/logout', requireAuth, async (req: Request, res: Response) => {
    if (req.rawToken) {
      const tokenHash = hashToken(req.rawToken);
      await sessionRepo.revokeSession(tokenHash);
    }
    res.clearCookie('session_token');
    return res.json({ success: true, message: 'Đã đăng xuất an toàn' });
  });

  /**
   * GET /api/auth/me
   */
  router.get('/me', async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ user: null });
    }
    return res.json({ user: req.user });
  });

  return router;
}
