import type { Env } from "./env.js";

const PROJECT_ID = 189316;
const HOST = "https://eu.posthog.com";

export class UpstreamError extends Error {
  constructor(public status: number, body: string) {
    super(`upstream ${status}: ${body.slice(0, 200)}`);
  }
}

export async function runQuery<TRow>(
  env: Env,
  sql: string,
  values: Record<string, string | number>,
): Promise<TRow[]> {
  const res = await fetch(`${HOST}/api/projects/${PROJECT_ID}/query/`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.POSTHOG_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      query: { kind: "HogQLQuery", query: sql, values },
    }),
  });
  if (!res.ok) {
    throw new UpstreamError(res.status, await res.text().catch(() => ""));
  }
  const json = (await res.json()) as { results: unknown[][]; columns: string[] };
  return json.results.map((row) => {
    const obj: Record<string, unknown> = {};
    json.columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj as TRow;
  });
}
