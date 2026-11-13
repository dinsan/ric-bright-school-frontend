import Link from "next/link";
import type { LegalSection } from "../components/legal-page";
import { DataTable } from "../components/prose";
import { cookies, localStorageItems, type StoredItem } from "../device-storage";

const rows = (items: StoredItem[]) => items.map((item) => [<code key="name">{item.name}</code>, item.purpose, item.duration]);

export const cookiesSummary = [
  "Lumina only stores what it needs to work: keeping you signed in safely, and remembering your display choices.",
  "No advertising cookies, no tracking, no analytics, nothing from other companies. That's why there is no cookie banner.",
  "Everything is listed below, with what it does and how long it lasts.",
];

export const cookiesSections: LegalSection[] = [
  {
    id: "what-we-use",
    title: "What we use and why",
    content: (
      <>
        <p>
          A cookie is a small piece of text a website asks your browser to keep and send back. Local storage is similar, but
          stays in your browser and is never sent to us. Lumina uses both, only for the purposes below.
        </p>
        <p>
          All of them are <strong>strictly necessary</strong> (to sign you in and keep your account secure) or remember a
          choice you made (your colours and reading level). Privacy laws allow these without asking first, because Lumina
          can&apos;t work as you asked without them.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies",
    content: (
      <>
        <p>
          Set by Lumina only (first-party). The sign-in cookies are <em>httpOnly</em> (scripts in the page can&apos;t read
          them), sent only to Lumina, and only over a secure connection on the live site.
        </p>
        <DataTable caption="Cookies Lumina sets" columns={["Name", "What it does", "How long it lasts"]} rows={rows(cookies)} />
      </>
    ),
  },
  {
    id: "local-storage",
    title: "Local storage on your device",
    content: (
      <>
        <p>These stay in your browser. Lumina&apos;s server never receives them.</p>
        <DataTable caption="What Lumina keeps in local storage" columns={["Name", "What it does", "How long it lasts"]} rows={rows(localStorageItems)} />
      </>
    ),
  },
  {
    id: "what-we-dont-use",
    title: "What we don't use",
    content: (
      <ul>
        <li>No advertising or marketing cookies.</li>
        <li>No analytics or tracking tools, and no &ldquo;pixels&rdquo; from social networks.</li>
        <li>No fonts, scripts or videos loaded from other companies while you use Lumina.</li>
      </ul>
    ),
  },
  {
    id: "other-sites",
    title: "Signing in with Google, Microsoft or Apple",
    content: (
      <p>
        If you choose one of these, your browser visits their website to sign in, and their own cookies and privacy
        policies apply there. When you come back to Lumina, only the cookies above are used.
      </p>
    ),
  },
  {
    id: "control",
    title: "How to control them",
    content: (
      <>
        <p>
          Your browser&apos;s settings let you see and delete cookies and site data. If you delete Lumina&apos;s cookies you
          are signed out; if you delete its local storage, your colour and reading-level choices go back to the defaults.
          Blocking Lumina&apos;s cookies altogether means you can&apos;t sign in.
        </p>
        <p>
          If we ever want to use a cookie that isn&apos;t strictly necessary, we&apos;ll ask first, and you&apos;ll be able to
          say no without losing anything you need. This page will list it. See also our <Link href="/privacy">privacy policy</Link>.
        </p>
      </>
    ),
  },
];
