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
  return photoFromPage(`https://${domain}`);
}

// The og:image a page publishes, kept only if it is a real photo.
export async function photoFromPage(pageUrl: string): Promise<string | null> {
  const page = await fetch(pageUrl, { headers: BROWSER, redirect: "follow", signal: AbortSignal.timeout(8_000) }).catch(() => null);
  if (!page?.ok) return null;
  const url = ogImage(await page.text().catch(() => ""), page.url);
  if (!url) return null;
  const img = await fetch(url, { headers: BROWSER, signal: AbortSignal.timeout(8_000) }).catch(() => null);
  if (!img?.ok || Number(img.headers.get("content-length") ?? 0) > 5_000_000) return null;
  const buffer = Buffer.from(await img.arrayBuffer());
  return (await looksLikePhoto(buffer).catch(() => false)) ? url : null;
}

export async function fillCovers(db: SupabaseClient, limit = 100, concurrency = 6) {
  const { data } = await db.from("companies").select("id, domain, careers_url").not("domain", "is", null).is("cover_checked_at", null).limit(limit);
  const list = data ?? [];
  let next = 0;
  let found = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < list.length) {
        const c = list[next++];
        // The homepage first, then the careers page, which often shows the team.
        const cover = (await findCover(c.domain).catch(() => null)) ?? (c.careers_url ? await photoFromPage(c.careers_url).catch(() => null) : null);
        if (cover) found++;
        await db.from("companies").update({ cover_url: cover, cover_checked_at: new Date().toISOString() }).eq("id", c.id);
      }
    }),
  );
  return { checked: list.length, found };
}

// What the company does, in its own words: the description its homepage gives for link previews.
// Kept short, and dropped when it is only a cookie notice or a slogan of a few words.
export function metaDescription(html: string): string | null {
  const m =
    html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["'](?:description|og:description)["']/i);
  if (!m) return null;
  const text = m[1]
    .replace(/&amp;/g, "&").replace(/&#0?39;|&apos;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 40 || /cookie|javascript|captcha|access denied/i.test(text)) return null;
  if (text.length <= 240) return text;
  const cut = text.slice(0, 240);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(". ") + 1, cut.lastIndexOf(" "))).trim()}…`;
}

export async function fillAbout(db: SupabaseClient, limit = 150, concurrency = 8) {
  const { data } = await db.from("companies").select("id, domain").not("domain", "is", null).is("about_checked_at", null).limit(limit);
  const list = data ?? [];
  let next = 0;
  let found = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < list.length) {
        const c = list[next++];
        const page = await fetch(`https://${c.domain}`, { headers: { ...BROWSER, "Accept-Language": "fr-FR,fr;q=0.9" }, redirect: "follow", signal: AbortSignal.timeout(8_000) }).catch(() => null);
        const about = page?.ok ? metaDescription(await page.text().catch(() => "")) : null;
        if (about) found++;
        await db.from("companies").update({ about, about_checked_at: new Date().toISOString() }).eq("id", c.id);
      }
    }),
  );
  return { checked: list.length, found };
}

// A photo for each offer someone sees: the offer's own page often shows the team or the office
// (Teamtailor, Welcome Kit, career sites). Search-engine redirects are skipped.
export async function fillOfferImages(db: SupabaseClient, limit = 150, concurrency = 6) {
  const shown = new Set<string>();
  for (let f = 0; ; f += 1000) {
    const { data } = await db.from("offer_scores").select("offer_id").neq("level", "ecartee").range(f, f + 999);
    for (const r of data ?? []) shown.add(r.offer_id as string);
    if (!data || data.length < 1000) break;
  }
  const ids = [...shown];
  const list: { id: string; apply_url: string }[] = [];
  for (let i = 0; i < ids.length && list.length < limit; i += 100) {
    const { data } = await db.from("offers").select("id, apply_url").in("id", ids.slice(i, i + 100)).is("image_url", null).is("image_checked_at", null).is("archived_at", null);
    list.push(...((data ?? []) as { id: string; apply_url: string }[]).filter((o) => o.apply_url && !/adzuna|jooble|francetravail/.test(o.apply_url)));
  }
  let next = 0;
  let found = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < Math.min(list.length, limit)) {
        const o = list[next++];
        const image = await photoFromPage(o.apply_url).catch(() => null);
        if (image) found++;
        await db.from("offers").update({ image_url: image, image_checked_at: new Date().toISOString() }).eq("id", o.id);
      }
    }),
  );
  return { checked: Math.min(list.length, limit), found };
}
