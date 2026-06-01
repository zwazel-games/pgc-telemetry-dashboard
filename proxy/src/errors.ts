import type { ApiError } from "@pgc/shared";

export class ApiHttpError extends Error {
  constructor(public status: number, public body: ApiError) {
    super(body.error);
  }
}

export function jsonResponse(body: unknown, status: number, cacheSeconds: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": cacheSeconds > 0 ? `public, max-age=${cacheSeconds}` : "no-store",
    },
  });
}

export function jsonError(err: ApiError, status: number): Response {
  return jsonResponse(err, status, 0);
}
