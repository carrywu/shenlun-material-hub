import { APIRequestContext } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';

type StorageStateCookie = {
  name: string;
  value: string;
};

type StorageState = {
  cookies?: StorageStateCookie[];
};

type ListResponse<T = { id?: string }> = {
  items?: T[];
  length?: number;
  0?: T;
};

/** Get admin cookies from storage state for API calls */
export function getAdminCookies(): Record<string, string> {
  const authPath = path.resolve(__dirname, '..', '.auth', 'admin.json');
  if (!fs.existsSync(authPath)) return {};
  const state = JSON.parse(fs.readFileSync(authPath, 'utf-8')) as StorageState;
  const token = state.cookies?.find((cookie) => cookie.name === 'auth_token')?.value;
  return token ? { Cookie: `auth_token=${token}` } : {};
}

/** Check if approved articles exist */
export async function hasApprovedArticles(request: APIRequestContext): Promise<boolean> {
  const cookies = getAdminCookies();
  const res = await request.get(`${BASE_URL}/api/articles?limit=1`, { headers: cookies });
  if (!res.ok()) return false;
  const data = await res.json() as ListResponse;
  return (data.items?.length ?? 0) > 0;
}

/** Check if material cards exist */
export async function hasMaterialCards(request: APIRequestContext): Promise<boolean> {
  const cookies = getAdminCookies();
  const res = await request.get(`${BASE_URL}/api/material-cards?limit=1`, { headers: cookies });
  if (!res.ok()) return false;
  const data = await res.json() as ListResponse;
  return (data.items?.length ?? data.length ?? 0) > 0;
}

/** Check if candidate articles exist (for AI assessment) */
export async function hasCandidateArticles(request: APIRequestContext): Promise<boolean> {
  const cookies = getAdminCookies();
  const res = await request.get(
    `${BASE_URL}/api/content-items?qualityStatus=candidate&limit=1`,
    { headers: cookies }
  );
  if (!res.ok()) return false;
  const data = await res.json() as ListResponse;
  return (data.items?.length ?? data.length ?? 0) > 0;
}

/** Check if sources exist */
export async function hasSources(request: APIRequestContext): Promise<boolean> {
  const cookies = getAdminCookies();
  const res = await request.get(`${BASE_URL}/api/sources?limit=1`, { headers: cookies });
  if (!res.ok()) return false;
  const data = await res.json() as ListResponse;
  return (data.items?.length ?? data.length ?? 0) > 0;
}

/** Get first approved article ID */
export async function getFirstApprovedArticleId(request: APIRequestContext): Promise<string | null> {
  const cookies = getAdminCookies();
  const res = await request.get(`${BASE_URL}/api/articles?limit=1`, { headers: cookies });
  if (!res.ok()) return null;
  const data = await res.json() as ListResponse;
  return data.items?.[0]?.id ?? null;
}

/** Get first material card ID */
export async function getFirstCardId(request: APIRequestContext): Promise<string | null> {
  const cookies = getAdminCookies();
  const res = await request.get(`${BASE_URL}/api/material-cards?limit=1`, { headers: cookies });
  if (!res.ok()) return null;
  const data = await res.json() as ListResponse;
  return (data.items?.[0]?.id ?? data[0]?.id) ?? null;
}

/** Get first candidate article ID */
export async function getFirstCandidateArticleId(request: APIRequestContext): Promise<string | null> {
  const cookies = getAdminCookies();
  const res = await request.get(
    `${BASE_URL}/api/content-items?qualityStatus=candidate&limit=1`,
    { headers: cookies }
  );
  if (!res.ok()) return null;
  const data = await res.json() as ListResponse;
  return (data.items?.[0]?.id ?? data[0]?.id) ?? null;
}

/** Check WeWe RSS service availability */
export async function isWeWeRssAvailable(): Promise<boolean> {
  try {
    const res = await fetch('http://localhost:4000', { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}
