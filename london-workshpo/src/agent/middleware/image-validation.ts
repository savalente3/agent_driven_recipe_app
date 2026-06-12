import { createMiddleware } from "langchain";
import { ToolMessage } from "@langchain/core/messages";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/**
 * Probe a single image URL the same way the browser <img> will request it
 * (real UA, no referer, short timeout) and confirm it actually returns an
 * image. Headers are enough — we cancel the body without downloading it.
 */
async function imageLoads(url: string): Promise<boolean> {
  if (!url || typeof url !== "string") return false;

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(3500),
      headers: { "User-Agent": BROWSER_UA, Accept: "image/*" },
    });

    try { await res.body?.cancel(); } catch {}

    if (!res.ok) return false;
    return (res.headers.get("content-type") ?? "").startsWith("image/");
  } catch {
    return false;
  }
}

const urlOf = (img: unknown): string =>
  typeof img === "string" ? img : (img as { url?: string })?.url ?? "";

/**
 * Wraps tool calls and, for `search_recipes`, prunes the result's `images`
 * array down to URLs that genuinely load. Tavily's scraped image list is full
 * of dead and hotlink-blocked links; filtering them here — rather than inside
 * the tool — keeps the search tool pure and means the model only ever picks an
 * imageUrl from images that will actually render in the UI.
 */
export const imageValidationMiddleware = createMiddleware({
  name: "ImageValidationMiddleware",
  wrapToolCall: async (request, handler) => {
    const result = await handler(request);

    if (request.toolCall?.name !== "search_recipes") return result;
    if (!(result instanceof ToolMessage) || typeof result.content !== "string") return result;

    let payload: any;
    try { payload = JSON.parse(result.content); } catch { return result; }

    const images = Array.isArray(payload?.images) ? payload.images : [];
    if (images.length === 0) return result;

    const checked = await Promise.all(
      images.map(async (img: unknown) => ({ img, ok: await imageLoads(urlOf(img)) }))
    );
    payload.images = checked.filter(c => c.ok).map(c => c.img);

    return new ToolMessage({
      content: JSON.stringify(payload),
      tool_call_id: result.tool_call_id,
      name: result.name,
      status: result.status,
      artifact: result.artifact,
    });
  },
});
