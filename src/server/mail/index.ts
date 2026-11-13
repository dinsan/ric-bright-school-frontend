import "server-only";

import { after } from "next/server";
import { serverConfig } from "@/server/config";

/**
 * Outgoing email. Transports (MAIL_TRANSPORT, see src/server/config.ts):
 * - smtp:   SMTP_URL (any provider: SES, Postmark, Mailgun, Gmail…), sent with nodemailer;
 * - log:    printed to the server log (the default without SMTP_URL, for local development);
 * - memory: kept in `outbox` (tests).
 * Emails are sent after the response (next/server `after`), so answers take the same time whether or not
 * an email goes out (no account enumeration by timing), and a slow mail server never slows sign-up.
 */

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Emails sent with the memory transport, newest last. */
export const outbox: Mail[] = [];

type Transporter = { sendMail(mail: Mail & { from: string }): Promise<unknown> };
let transporter: Promise<Transporter> | null = null;

async function smtp(): Promise<Transporter> {
  transporter ??= import("nodemailer").then((nodemailer) => nodemailer.createTransport(serverConfig().SMTP_URL!) as Transporter);
  return transporter;
}

async function deliver(mail: Mail) {
  const config = serverConfig();
  try {
    switch (config.MAIL_TRANSPORT) {
      case "memory":
        outbox.push(mail);
        return;
      case "log":
        console.info(`[mail] to=${mail.to} subject="${mail.subject}"\n${mail.text}\n`);
        return;
      case "smtp":
        await (await smtp()).sendMail({ ...mail, from: config.MAIL_FROM });
        return;
    }
  } catch (error) {
    // The person can ask for the email again; never fail the request that triggered it.
    console.error(`[mail] sending "${mail.subject}" failed`, error);
  }
}

/** Queues an email to be sent once the response has gone out. */
export async function sendMail(mail: Mail): Promise<void> {
  if (serverConfig().MAIL_TRANSPORT === "memory") return deliver(mail);
  try {
    after(() => deliver(mail));
  } catch {
    // Outside a request (scripts): send now.
    await deliver(mail);
  }
}
