import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

// A cover photo from the company's own site: the og:image it publishes for link previews.
// Only the URL is stored. Rejected: small or oddly shaped images, and logos on a flat background.

const BROWSER = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15" };

function ogImage(html: string, base: string): string | null {
  const m =
    html.match(/<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image)["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/i);
  if (!m) return null;
  try {
    return new URL(m[1].replace(/&amp;/g, "&"), base).href;
  } catch {
    return null;
  }
}

// Photo-like: wide enough, landscape, and not dominated by one flat colour (a logo card).
export async function looksLikePhoto(buffer: Buffer): Promise<boolean> {
  const img = sharp(buffer);
  const meta = await img.metadata();
  if (!meta.width || !meta.height || meta.width < 600) return false;
  const ratio = meta.width / meta.height;
  if (ratio < 1.2 || ratio > 2.6) return false;
  const { data } = await img.resize(64, 32, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const buckets = new Map<string, number>();
  for (let i = 0; i < data.length; i += 3) {
    const k = `${data[i] >> 4},${data[i + 1] >> 4},${data[i + 2] >> 4}`;
    buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  const pixels = data.length / 3;
  const top = Math.max(...buckets.values());
  return top / pixels < 0.45 && buckets.size > 40;
}

export async function findCover(domain: string): Promise<string | null> {
  const page = await fetch(`https://${domain}`, { headers: BROWSER, redirect: "follow", signal: AbortSignal.timeout(8_000) }).catch(() => null);
  if (!page?.ok) return null;
  const url = ogImage(await page.text().catch(() => ""), page.url);
  if (!url) return null;
  const img = await fetch(url, { headers: BROWSER, signal: AbortSignal.timeout(8_000) }).catch(() => null);
  if (!img?.ok || Number(img.headers.get("content-length") ?? 0) > 5_000_000) return null;
  const buffer = Buffer.from(await img.arrayBuffer());
  return (await looksLikePhoto(buffer).catch(() => false)) ? url : null;
}

export async function fillCovers(db: SupabaseClient, limit = 100, concurrency = 6) {
  const { data } = await db.from("companies").select("id, domain").not("domain", "is", null).is("cover_checked_at", null).limit(limit);
  const list = data ?? [];
  let next = 0;
  let found = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < list.length) {
        const c = list[next++];
        const cover = await findCover(c.domain).catch(() => null);
        if (cover) found++;
        await db.from("companies").update({ cover_url: cover, cover_checked_at: new Date().toISOString() }).eq("id", c.id);
      }
    }),
  );
  return { checked: list.length, found };
}
