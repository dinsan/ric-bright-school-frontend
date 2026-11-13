import "server-only";

import type { Mail } from "./index";

/**
 * Email content. Plain words, short sentences (the product's writing rules in lib/forms/messages.ts),
 * and a plain-text version of every email; the HTML version is the same text with a link.
 */

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

function build(to: string, subject: string, paragraphs: string[], action?: { label: string; url: string }): Mail {
  const text = [...paragraphs, ...(action ? [`${action.label}: ${action.url}`] : []), "— Lumina"].join("\n\n");
  const html = [
    ...paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`),
    action ? `<p><a href="${escapeHtml(action.url)}">${escapeHtml(action.label)}</a></p>` : "",
    "<p>— Lumina</p>",
  ].join("\n");
  return { to, subject, text, html };
}

export const emails = {
  verifyEmail: (to: string, name: string, url: string) =>
    build(
      to,
      "Confirm your email address",
      [`Hi ${name},`, "Open the link below to confirm your email address and finish setting up your Lumina account. The link works for 48 hours."],
      { label: "Confirm my email", url },
    ),

  accountExists: (to: string, signInUrl: string, resetUrl: string) =>
    build(to, "You already have a Lumina account", [
      "Someone (probably you) tried to create a Lumina account with this email address, but it already has one.",
      `Sign in here: ${signInUrl}`,
      `Forgot your password? Choose a new one here: ${resetUrl}`,
      "If this wasn't you, you can ignore this email.",
    ]),

  resetPassword: (to: string, name: string, url: string) =>
    build(
      to,
      "Choose a new password",
      [`Hi ${name},`, "Open the link below to choose a new Lumina password. The link works once, for 1 hour.", "If you didn't ask for this, ignore this email: your password stays the same."],
      { label: "Choose a new password", url },
    ),

  confirmEmailChange: (to: string, name: string, url: string) =>
    build(
      to,
      "Confirm your new email address",
      [`Hi ${name},`, "Open the link below to start using this address for Lumina. The link works for 24 hours."],
      { label: "Confirm my new email", url },
    ),

  emailChangeRequested: (to: string, name: string, newEmail: string) =>
    build(to, "Your Lumina email address is changing", [
      `Hi ${name},`,
      `Someone asked to change the email address of your Lumina account to ${newEmail}. The change happens when the link sent to that address is opened.`,
      "If this wasn't you, change your password now and contact your school or Lumina support.",
    ]),

  passwordChanged: (to: string, name: string) =>
    build(to, "Your Lumina password was changed", [
      `Hi ${name},`,
      "Your password was just changed, and your other devices were signed out.",
      "If this wasn't you, choose a new password with \"Forgot your password?\" on the sign-in page, and contact Lumina support.",
    ]),
};
