import { Router, Request, Response } from 'express';
import { McpRepository } from '../repositories/mcp-repo.ts';
import { requireAuth } from '../auth/middleware.ts';

export function createOAuthRouter(mcpRepo: McpRepository) {
  const router = Router();

  // RFC 8414 OAuth 2.0 Authorization Server Metadata
  router.get('/.well-known/oauth-authorization-server', (req: Request, res: Response) => {
    const origin = `${req.protocol}://${req.get('host')}`;
    return res.json({
      issuer: origin,
      authorization_endpoint: `${origin}/oauth/authorize`,
      token_endpoint: `${origin}/oauth/token`,
      registration_endpoint: `${origin}/oauth/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
      scopes_supported: ['search_1688_products', 'verify_product_price', 'evaluate_facebook_ads']
    });
  });

  // Client dynamic registration
  router.post('/oauth/register', requireAuth, async (req: Request, res: Response) => {
    try {
      const { clientName, redirectUris, allowedScopes, isConfidential } = req.body;
      if (!clientName || !redirectUris || !Array.isArray(redirectUris)) {
        return res.status(400).json({ error: 'clientName and redirectUris array are required' });
      }

      const client = await mcpRepo.registerOAuthClient({
        clientName,
        redirectUris,
        allowedScopes: allowedScopes || ['search_1688_products', 'verify_product_price', 'evaluate_facebook_ads'],
        isConfidential: Boolean(isConfidential)
      });

      return res.status(201).json(client);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // OAuth 2.1 Authorize endpoint (PKCE required)
  router.get('/oauth/authorize', requireAuth, async (req: Request, res: Response) => {
    try {
      const {
        client_id,
        redirect_uri,
        response_type,
        scope = 'search_1688_products',
        code_challenge,
        code_challenge_method = 'S256',
        state
      } = req.query as Record<string, string>;

      if (response_type !== 'code') {
        return res.status(400).json({ error: 'unsupported_response_type', error_description: 'Only code response_type is supported' });
      }

      if (!code_challenge) {
        return res.status(400).json({ error: 'invalid_request', error_description: 'PKCE code_challenge is mandatory in OAuth 2.1' });
      }

      const scopes = scope.split(' ');
      const code = await mcpRepo.createAuthCode({
        clientId: client_id,
        userId: req.user!.id,
        redirectUri: redirect_uri,
        scopes,
        codeChallenge: code_challenge,
        codeChallengeMethod: code_challenge_method
      });

      const redirectUrl = new URL(redirect_uri);
      redirectUrl.searchParams.set('code', code);
      if (state) redirectUrl.searchParams.set('state', state);

      return res.redirect(redirectUrl.toString());
    } catch (err: any) {
      return res.status(400).json({ error: 'server_error', error_description: err.message });
    }
  });

  // OAuth 2.1 Token endpoint
  router.post('/oauth/token', async (req: Request, res: Response) => {
    try {
      const {
        grant_type,
        client_id,
        code,
        redirect_uri,
        code_verifier
      } = req.body;

      if (grant_type !== 'authorization_code') {
        return res.status(400).json({ error: 'unsupported_grant_type', error_description: 'Only authorization_code grant is supported' });
      }

      if (!code_verifier) {
        return res.status(400).json({ error: 'invalid_request', error_description: 'PKCE code_verifier is mandatory' });
      }

      const tokenResult = await mcpRepo.exchangeAuthCode({
        clientId: client_id,
        code,
        redirectUri: redirect_uri,
        codeVerifier: code_verifier
      });

      if (!tokenResult) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'Mã xác thực hoặc code_verifier không hợp lệ hoặc đã hết hạn' });
      }

      return res.json({
        access_token: tokenResult.accessToken,
        token_type: 'Bearer',
        expires_in: tokenResult.expiresIn,
        scope: tokenResult.scopes.join(' ')
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'server_error', error_description: err.message });
    }
  });

  return router;
}
