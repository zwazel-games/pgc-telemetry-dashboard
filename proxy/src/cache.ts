export async function cacheJson(
  req: Request,
  ctx: ExecutionContext,
  handler: () => Promise<Response>,
): Promise<Response> {
  if (req.method !== "GET") return handler();

  const cache = caches.default;
  const cacheKey = new Request(req.url, { method: "GET" });
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const res = await handler();
  if (res.ok) {
    ctx.waitUntil(cache.put(cacheKey, res.clone()));
  }
  return res;
}
