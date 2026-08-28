import { randomBytes } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { NextResponse } from 'next/server';

const OAUTH_STATE_COOKIE = 'beyx_oauth_state';

function callbackUrl(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
  const base = configured || new URL(request.url).origin;
  return new URL('/api/auth/callback', base).toString();
}

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/login?error=oauth_unavailable', request.url));
  }

  const state = randomBytes(32).toString('base64url');
  const oauth = new OAuth2Client(clientId, clientSecret, callbackUrl(request));
  const authorizationUrl = oauth.generateAuthUrl({
    access_type: 'online',
    scope: ['openid', 'email', 'profile'],
    state,
    prompt: 'select_account',
  });
  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60,
  });
  return response;
}
