import { test as setup, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';
const AUTH_DIR = path.resolve(__dirname, '.auth');

interface Account {
  username: string;
  password: string;
  role: string;
  file: string;
  context?: string;
}

const accounts: Account[] = [
  { username: 'admin', password: 'admin123', role: 'ADMIN', file: 'admin.json', context: 'admin' },
  { username: 'e2e_verified', password: 'verified123', role: 'VERIFIED_USER', file: 'verified.json' },
  { username: 'e2e_usera', password: 'usera123', role: 'USER', file: 'usera.json' },
];

setup('authenticate all accounts', async ({ request }) => {
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  // Seed E2E accounts first
  const seedResult = await request.post(`${BASE_URL}/api/auth/register`, {
    data: { username: 'e2e_seed_check', password: 'seed123' },
    headers: { 'Content-Type': 'application/json' },
  }).catch(() => null);
  // Ignore seed errors - accounts already exist from pnpm seed:e2e-accounts

  for (const acc of accounts) {
    const res = await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        username: acc.username,
        password: acc.password,
        context: acc.context || 'user',
      },
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok()) {
      console.warn(`[global-setup] Login failed for ${acc.username}: ${res.status()}`);
      // Create empty storage state as fallback
      fs.writeFileSync(
        path.join(AUTH_DIR, acc.file),
        JSON.stringify({ cookies: [], origins: [] })
      );
      continue;
    }

    const cookies = res.headersArray()
      .filter(h => h.name.toLowerCase() === 'set-cookie')
      .map(h => h.value);

    const authCookie = cookies.find(c => c.startsWith('auth_token='));
    if (!authCookie) {
      console.warn(`[global-setup] No auth_token cookie for ${acc.username}`);
      fs.writeFileSync(
        path.join(AUTH_DIR, acc.file),
        JSON.stringify({ cookies: [], origins: [] })
      );
      continue;
    }

    const value = authCookie.split(';')[0].replace('auth_token=', '');
    const storageState = {
      cookies: [{
        name: 'auth_token',
        value,
        domain: 'localhost',
        path: '/',
        expires: Date.now() / 1000 + 86400,
        httpOnly: true,
        secure: false,
        sameSite: 'Lax' as const,
      }],
      origins: [],
    };

    fs.writeFileSync(path.join(AUTH_DIR, acc.file), JSON.stringify(storageState));
    console.log(`[global-setup] ✓ ${acc.username} (${acc.role}) authenticated`);
  }
});
