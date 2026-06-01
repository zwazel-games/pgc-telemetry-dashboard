const COMMON_HEADERS: HeadersInit = {
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
  vary: "Origin",
};

export function preflight(origin: string): Response {
  return new Response(null, {
    status: 204,
    headers: { ...COMMON_HEADERS, "access-control-allow-origin": origin },
  });
}

export function withCors(res: Response, origin: string): Response {
  const headers = new Headers(res.headers);
  headers.set("access-control-allow-origin", origin);
  headers.set("vary", "Origin");
  return new Response(res.body, { status: res.status, headers });
}
