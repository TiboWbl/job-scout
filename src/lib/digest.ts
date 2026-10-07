import type { SupabaseClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "node:crypto";
import nodemailer from "nodemailer";
import { logoUrl } from "@/lib/design/color";

// A short email with the new crushes, sent through the Gmail account that runs Scout (an app password,
// free up to 500 emails a day). Off unless the person turns it on in Paramètres; nothing when there is
// nothing new.
const SITE = process.env.SITE_URL ?? "https://scout-tibow.vercel.app";

export function isDigestConfigured() {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

// The unsubscribe link works without signing in: it carries the person's id and a signature only the
// server can make (keyed on the service role secret, present wherever emails are sent or links read).
export function unsubscribeToken(userId: string) {
  return createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").update(`digest-unsubscribe:${userId}`).digest("base64url");
}
export function unsubscribeUrl(userId: string) {
  return `${SITE}/desabonnement?u=${userId}&t=${unsubscribeToken(userId)}`;
}
export function isUnsubscribeToken(userId: string, token: string) {
  const expected = Buffer.from(unsubscribeToken(userId));
  const given = Buffer.from(token);
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) && expected.length === given.length && timingSafeEqual(expected, given);
}

export type Crush = { id: string; title: string; company: string; domain: string | null; why: string | null };

const SHOWN = 10;
const INK = "#17151f";
const MUTED = "#6b6577";
const BRAND = "#6d5bf0";

// Email clients need tables and inline styles; images are PNG on the public site, logos from logo.dev.
export function digestHtml(firstName: string | null, crushes: Crush[], unsubscribe: string) {
  const shown = crushes.slice(0, SHOWN);
  const more = crushes.length - shown.length;
  const logo = (c: Crush) => {
    const url = c.domain ? logoUrl(c.domain, 64) : null;
    return url
      ? `<img src="${escape(url)}" width="40" height="40" alt="" style="display:block;border-radius:10px;border:1px solid #ece9f1">`
      : `<div style="width:40px;height:40px;border-radius:10px;background:#ece6ff;color:#4a3bc4;font-weight:700;font-size:17px;line-height:40px;text-align:center">${escape((c.company.trim()[0] ?? "?").toUpperCase())}</div>`;
  };
  const cards = shown
    .map(
      (c) => `<tr><td style="padding:0 0 10px">
<a href="${SITE}/offres?offre=${c.id}" style="display:block;text-decoration:none;color:${INK};border:1px solid #ece9f1;border-radius:16px;padding:14px 16px;background:#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="52" valign="top">${logo(c)}</td>
<td valign="top">
<div style="font-size:16px;font-weight:700;line-height:1.3;color:${INK}">${escape(c.title)}</div>
<div style="font-size:14px;color:${MUTED};margin-top:2px">${escape(c.company)}</div>
${c.why ? `<div style="font-size:14px;line-height:1.45;color:#3d3847;margin-top:8px">${escape(c.why)}</div>` : ""}
<div style="font-size:14px;font-weight:600;color:${BRAND};margin-top:10px">Voir l'offre &rarr;</div>
</td></tr></table>
</a></td></tr>`,
    )
    .join("");
  const count = crushes.length > 1 ? `${crushes.length} nouveaux coups de cœur` : "Un nouveau coup de cœur";
  return `<!doctype html><html lang="fr"><body style="margin:0;padding:0;background:#f6f4f9">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f4f9"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:Inter,-apple-system,'Segoe UI',Arial,sans-serif;color:${INK}">
<tr><td style="padding:0 4px 20px">
<a href="${SITE}" style="text-decoration:none;color:${INK}"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td><img src="${SITE}/brand/scout-logo-120.png" width="36" height="36" alt="Scout" style="display:block;border-radius:9px"></td>
<td style="padding-left:10px;font-size:20px;font-weight:800;letter-spacing:-0.3px">Scout</td>
</tr></table></a>
</td></tr>
<tr><td style="background:#ffffff;border-radius:22px;padding:26px 22px">
<div style="font-size:15px;color:${MUTED}">${firstName ? `Salut ${escape(firstName)},` : "Salut,"}</div>
<div style="font-size:26px;font-weight:800;line-height:1.2;letter-spacing:-0.4px;margin:6px 0 4px">${count} pour toi</div>
<div style="font-size:15px;color:${MUTED};margin-bottom:20px">Les offres que Scout a jugées les plus proches de ta recherche depuis le dernier email. Touche une offre pour la voir dans Scout.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${cards}</table>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:12px"><tr><td style="background:${INK};border-radius:12px">
<a href="${SITE}/offres" style="display:inline-block;padding:13px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none">${more > 0 ? `Voir les ${more} autres et toutes mes offres` : "Voir toutes mes offres"}</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:18px 8px 0;font-size:12.5px;line-height:1.5;color:${MUTED};text-align:center">
Tu reçois cet email parce que tu l'as activé dans les Paramètres de Scout.<br>
<a href="${escape(unsubscribe)}" style="color:${MUTED};text-decoration:underline">Ne plus recevoir ces emails</a>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export async function sendDigests(db: SupabaseClient) {
  if (!isDigestConfigured()) return { people: 0, sent: 0, offers: 0 };
  const transport = nodemailer.createTransport({ service: "gmail", auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } });
  const { data: profiles } = await db.from("profiles").select("id, display_name, criteria_version, digest_sent_at").eq("email_digest", true);
  let sent = 0;
  let offers = 0;
  for (const p of profiles ?? []) {
    // One email a day at most: the first sort of the day after 20 hours sends it.
    if (p.digest_sent_at && Date.now() - new Date(p.digest_sent_at).getTime() < 20 * 3_600_000) continue;
    // New since the last email (or the last day for a first one).
    const since = p.digest_sent_at ?? new Date(Date.now() - 86_400_000).toISOString();
    const [{ data: rows }, { data: dismissed }, { data: user }] = await Promise.all([
      db.from("offer_scores").select("why, created_at, offer:offers(id, title, archived_at, company:companies(name, domain))").eq("user_id", p.id).eq("criteria_version", p.criteria_version).eq("level", "coeur").gt("created_at", since),
      db.from("user_offers").select("offer_id").eq("user_id", p.id).eq("dismissed", true),
      db.auth.admin.getUserById(p.id),
    ]);
    const hidden = new Set((dismissed ?? []).map((d) => d.offer_id as string));
    type Row = { why: string | null; offer: { id: string; title: string; archived_at: string | null; company: { name: string; domain: string | null } | null } | null };
    const crushes: Crush[] = ((rows ?? []) as unknown as Row[])
      .filter((r) => r.offer && !r.offer.archived_at && !hidden.has(r.offer.id))
      .map((r) => ({ id: r.offer!.id, title: r.offer!.title, company: r.offer!.company?.name ?? "", domain: r.offer!.company?.domain ?? null, why: r.why }));
    const email = user?.user?.email;
    if (crushes.length > 0 && email) {
      await transport.sendMail({
        from: `Scout <${process.env.GMAIL_USER}>`,
        to: email,
        subject: crushes.length > 1 ? `${crushes.length} nouveaux coups de cœur sur Scout` : "Un nouveau coup de cœur sur Scout",
        html: digestHtml(p.display_name, crushes, unsubscribeUrl(p.id)),
        // One-click unsubscribe from the mail app itself (Gmail, Apple Mail).
        headers: { "List-Unsubscribe": `<${SITE}/api/digest/unsubscribe?u=${p.id}&t=${unsubscribeToken(p.id)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      });
      sent++;
      offers += crushes.length;
    }
    await db.from("profiles").update({ digest_sent_at: new Date().toISOString() }).eq("id", p.id);
  }
  return { people: (profiles ?? []).length, sent, offers };
}
