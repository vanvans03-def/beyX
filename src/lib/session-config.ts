export const SESSION_COOKIE_NAME = 'session';
export const SESSION_ISSUER = 'beyx';
export const SESSION_AUDIENCE = 'beyx-web';
export const SESSION_TTL_SECONDS = 24 * 60 * 60;

export const SESSION_ROLES = ['superadmin', 'admin', 'user'] as const;
export type SessionRole = typeof SESSION_ROLES[number];

export function isSessionRole(role: unknown): role is SessionRole {
  return typeof role === 'string' && SESSION_ROLES.some(value => value === role);
}

export function getSessionSecret(): string {
  const secret = process.env.APP_SESSION_SECRET || process.env.SUPABASE_JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('APP_SESSION_SECRET must contain at least 32 characters');
  }
  return secret;
}
