// Tells the person who runs Scout that the scheduled job failed, by email (the Gmail account that
// sends the digests writes to itself). Usage: npm run alert. Logs nothing personal (CI logs are public).
import { config } from "dotenv";
import nodemailer from "nodemailer";

config({ path: ".env.local", quiet: true });

const user = process.env.GMAIL_USER;
const pass = process.env.GMAIL_APP_PASSWORD;
if (!user || !pass) {
  console.log("alerte non envoyée : email non configuré");
  process.exit(0);
}
const run = process.env.GITHUB_SERVER_URL && process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : null;
await nodemailer.createTransport({ service: "gmail", auth: { user, pass } }).sendMail({
  from: `Scout <${user}>`,
  to: user,
  subject: "Scout : la collecte ou le tri a échoué",
  text: `Le passage planifié de Scout s'est arrêté sur une erreur. Les offres de ce passage ne sont peut-être pas à jour.${run ? `\n\nLe détail : ${run}` : ""}\n\nLe passage suivant réessaiera de lui-même.`,
});
console.log("alerte envoyée");
