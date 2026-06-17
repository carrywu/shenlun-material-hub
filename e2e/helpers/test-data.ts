import { APIRequestContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';

type StorageStateCookie = {
  name: string;
  value: string;
};

type StorageState = {
  cookies?: StorageStateCookie[];
};

type ListResponse<T = { id?: string }> = {
  data?: T[];
  items?: T[];
  length?: number;
  0?: T;
};

/** Get admin cookies from storage state for API calls */
export function getAdminCookies(): Record<string, string> {
  const authPath = resolve(process.cwd(), '.auth', 'admin-storage.json');
  try {
    const state = JSON.parse(readFileSync(authPath, 'utf-8')) as StorageState;
    const token = state.cookies?.find((cookie) => cookie.name === 'auth_token')?.value;
    return token ? { Cookie: `auth_token=${token}` } : {};
  } catch {
    return {};
  }
}

/** Get first approved article ID */
export async function getFirstApprovedArticleId(
  request: APIRequestContext,
): Promise<string | null> {
  const cookies = getAdminCookies();
  const res = await request.get(`${BASE_URL}/api/articles?pageSize=1`, {
    headers: cookies,
  });
  if (!res.ok()) return null;
  const data = (await res.json()) as ListResponse;
  return data.data?.[0]?.id ?? data.items?.[0]?.id ?? null;
}
