export const SESSION_COOKIE_NAME = 'session';
export const SESSION_ISSUER = 'beyx';
export const SESSION_AUDIENCE = 'beyx-web';
export const SESSION_TTL_SECONDS = 24 * 60 * 60;

export function getSessionSecret(): string {
  const secret = process.env.APP_SESSION_SECRET || process.env.SUPABASE_JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('APP_SESSION_SECRET must contain at least 32 characters');
  }
  return secret;
}
