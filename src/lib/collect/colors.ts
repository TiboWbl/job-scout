import sharp from "sharp";
import { dominantColor, logoUrl } from "@/lib/design/color";

// Downloads the logo only to read its pixels; nothing but the resulting hex is kept.
export async function extractAccent(domain: string | null, name: string): Promise<string | null> {
  const url = logoUrl(domain, 64, name);
  if (!url) return null;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return null;
  const { data } = await sharp(Buffer.from(await res.arrayBuffer()))
    .resize(48, 48, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return dominantColor(new Uint8Array(data));
}
