import { Request, Response, NextFunction } from 'express';
import { SessionRepository } from '../repositories/session-repo.ts';
import { hashToken } from './crypto.ts';
import { PermissionKey, User } from '../contracts/index.ts';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      rawToken?: string;
    }
  }
}

export function createAuthMiddleware(sessionRepo: SessionRepository) {
  return async (req: Request, res: Response, next: NextFunction) => {
    let rawToken: string | undefined;

    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      rawToken = authHeader.substring(7).trim();
    }

    // Check Cookie header
    if (!rawToken && req.headers.cookie) {
      const match = req.headers.cookie.match(/session_token=([^;]+)/);
      if (match) {
        rawToken = match[1];
      }
    }

    if (!rawToken) {
      return next();
    }

    try {
      const tokenHash = hashToken(rawToken);
      const user = await sessionRepo.findUserByTokenHash(tokenHash);
      if (user) {
        req.user = user;
        req.rawToken = rawToken;
      }
    } catch (err) {
      // Ignore token verification errors
    }

    next();
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Yêu cầu đăng nhập để truy cập tài nguyên này' });
  }

  if (req.user.status === 'PENDING_APPROVAL') {
    return res.status(403).json({ error: 'Tài khoản đang chờ phê duyệt bởi Quản trị viên' });
  }

  if (req.user.status === 'DEACTIVATED' || req.user.status === 'REJECTED') {
    return res.status(403).json({ error: 'Tài khoản đã bị tạm khóa hoặc từ chối truy cập' });
  }

  next();
}

/**
 * CSRF Protection Middleware for state-mutating requests (POST, PUT, PATCH, DELETE)
 * Exempts Bearer-token requests (Remote MCP / API tokens / automated tests)
 * Validates custom header 'x-requested-with' or Sec-Fetch-Site for browser cookie sessions
 */
export function requireCsrfProtection(req: Request, res: Response, next: NextFunction) {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return next();
  }

  // Exempt if authorization header is present (Bearer tokens are immune to standard cross-site form post CSRF)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return next();
  }

  // Check custom header or sec-fetch-site
  const customHeader = req.headers['x-requested-with'] || req.headers['x-csrf-token'];
  const secFetchSite = req.headers['sec-fetch-site'];

  if (secFetchSite === 'cross-site') {
    return res.status(403).json({ error: 'Từ chối truy cập do vi phạm chính sách CSRF (cross-site origin)' });
  }

  if (!customHeader && !secFetchSite) {
    // If neither is present, still allow if Content-Type is application/json (browsers do not send preflight-free JSON across origins)
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('application/json')) {
      return res.status(403).json({ error: 'Yêu cầu không hợp lệ: thiếu CSRF header bảo vệ' });
    }
  }

  next();
}

export function requirePermission(permission: PermissionKey) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Yêu cầu đăng nhập' });
    }

    // OWNER has all permissions
    if (req.user.status === 'OWNER') {
      return next();
    }

    if (!req.user.permissions.includes(permission)) {
      return res.status(403).json({
        error: `Bạn không có quyền thực hiện thao tác này (yêu cầu quyền '${permission}')`
      });
    }

    next();
  };
}
