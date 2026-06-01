import type { ApiEnvelope, ApiError } from "@pgc/shared";
import { API_BASE_URL } from "../lib/config.js";

export class ApiClientError extends Error {
  constructor(public status: number, public body: ApiError) {
    super(body.error);
  }
}

export async function apiEnvelope<T>(
  path: string,
  params?: Record<string, string | undefined>,
): Promise<ApiEnvelope<T>> {
  const url = new URL(path, API_BASE_URL);
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== "") url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = (await res.json().catch(() => ({ error: "network" }))) as ApiError;
    throw new ApiClientError(res.status, body);
  }
  return (await res.json()) as ApiEnvelope<T>;
}
