import { NextRequest } from "next/server";
import type { AuthUser } from "@/lib/auth";

type NextRequestOptions = ConstructorParameters<typeof NextRequest>[1];

function normalizeRequestOptions(options?: RequestInit): NextRequestOptions {
  const { signal, ...requestOptions } = options ?? {};
  return {
    ...requestOptions,
    ...(signal ? { signal } : {}),
  };
}

/**
 * Create a NextRequest with an auth cookie header.
 */
export function createAuthenticatedRequest(
  url: string,
  user: AuthUser,
  options?: RequestInit
): NextRequest {
  const headers = new Headers(options?.headers);
  if (!headers.has("cookie")) {
    headers.set("cookie", "auth_token=mock-session-token");
  }
  return new NextRequest(url, {
    ...normalizeRequestOptions(options),
    headers,
  });
}

/**
 * Create a NextRequest without any auth cookie (anonymous).
 */
export function createAnonymousRequest(
  url: string,
  options?: RequestInit
): NextRequest {
  return new NextRequest(url, normalizeRequestOptions(options));
}
