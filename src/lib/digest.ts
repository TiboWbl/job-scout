import type { SupabaseClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

// A short email with the new crushes, sent through the Gmail account that runs Scout (an app password,
// free up to 500 emails a day). Off unless the person turns it on in Paramètres; nothing when there is
// nothing new.
const SITE = process.env.SITE_URL ?? "https://scout-tibow.vercel.app";

export function isDigestConfigured() {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

type Crush = { id: string; title: string; company: string; why: string | null };

export function digestHtml(firstName: string | null, crushes: Crush[]) {
  const items = crushes
    .map(
      (c) => `<li style="margin:0 0 14px">
  <a href="${SITE}/offres?offre=${c.id}" style="color:#17151f;font-weight:700;text-decoration:none">${escape(c.title)}</a><br>
  <span style="color:#544f60">${escape(c.company)}</span>${c.why ? `<br><span style="color:#544f60;font-size:14px">${escape(c.why)}</span>` : ""}
</li>`,
    )
    .join("");
  return `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.5;color:#17151f;max-width:560px">
<p>${firstName ? `Salut ${escape(firstName)},` : "Salut,"}</p>
<p>Scout a trouvé ${crushes.length > 1 ? `${crushes.length} nouveaux coups de cœur` : "un nouveau coup de cœur"} pour toi :</p>
<ul style="padding-left:18px">${items}</ul>
<p><a href="${SITE}/offres" style="color:#6d5bf0;font-weight:600">Voir mes offres</a></p>
<p style="color:#544f60;font-size:13px">Tu reçois cet email parce que tu l'as activé dans les Paramètres de Scout. Tu peux le désactiver au même endroit.</p>
</div>`;
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
      db.from("offer_scores").select("why, created_at, offer:offers(id, title, archived_at, company:companies(name))").eq("user_id", p.id).eq("criteria_version", p.criteria_version).eq("level", "coeur").gt("created_at", since),
      db.from("user_offers").select("offer_id").eq("user_id", p.id).eq("dismissed", true),
      db.auth.admin.getUserById(p.id),
    ]);
    const hidden = new Set((dismissed ?? []).map((d) => d.offer_id as string));
    type Row = { why: string | null; offer: { id: string; title: string; archived_at: string | null; company: { name: string } | null } | null };
    const crushes: Crush[] = ((rows ?? []) as unknown as Row[])
      .filter((r) => r.offer && !r.offer.archived_at && !hidden.has(r.offer.id))
      .map((r) => ({ id: r.offer!.id, title: r.offer!.title, company: r.offer!.company?.name ?? "", why: r.why }));
    const email = user?.user?.email;
    if (crushes.length > 0 && email) {
      await transport.sendMail({
        from: `Scout <${process.env.GMAIL_USER}>`,
        to: email,
        subject: crushes.length > 1 ? `${crushes.length} nouveaux coups de cœur sur Scout` : "Un nouveau coup de cœur sur Scout",
        html: digestHtml(p.display_name, crushes.slice(0, 10)),
      });
      sent++;
      offers += crushes.length;
    }
    await db.from("profiles").update({ digest_sent_at: new Date().toISOString() }).eq("id", p.id);
  }
  return { people: (profiles ?? []).length, sent, offers };
}
