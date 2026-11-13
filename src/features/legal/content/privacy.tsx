import { Ban, EyeOff, KeyRound, MessageCircleHeart, Trash2, UserRound } from "lucide-react";
import Link from "next/link";
import { legalConfig } from "@/config/legal";
import { CLASSROOM_SESSION_SECONDS, IMPERSONATION_SESSION_SECONDS, SESSION_SECONDS } from "@/server/auth/cookies";
import { TOKEN_SECONDS } from "@/server/auth/tokens";
import type { KidsPoint } from "../components/kids-summary";
import type { LegalSection } from "../components/legal-page";
import { DataTable, EmailLink } from "../components/prose";
import { formatDuration } from "../device-storage";

const { contacts } = legalConfig;

/** For children, in the Grades 1–5 presentation. Short sentences, one idea each. */
export const privacyKidsPoints: KidsPoint[] = [
  { icon: UserRound, text: "To make your account, we keep your name, your grade and your username. That's all we need to know about you." },
  { icon: KeyRound, text: "Your password and your secret pictures are locked away. Not even the people who make Lumina can see them." },
  { icon: Ban, text: "Lumina never shows you adverts, and we never sell what we know about you." },
  { icon: EyeOff, text: "Other children can't see your account. Only you and the grown-ups who look after your learning can." },
  { icon: Trash2, text: "Your grown-up can ask us to change or delete your information at any time." },
  { icon: MessageCircleHeart, text: "If something online worries you, tell a grown-up you trust." },
];

/** For parents and teachers: the policy in a few lines. */
export const privacyInShort = [
  "We collect only what Lumina needs to run your account and keep it safe. Children don't need an email address.",
  "No advertising, no tracking, no selling or renting of personal information. Ever.",
  `Children under ${legalConfig.parentalConsentAge} get an account only through a parent or guardian (who gives consent) or their school.`,
  "You can see, correct, download or delete your information, and your children's. Just ask.",
];

const d = formatDuration;

export const privacySections: LegalSection[] = [
  {
    id: "who-we-are",
    title: "Who we are",
    content: (
      <>
        <p>
          Lumina is a learning platform for Grades 1 to 12, run by {legalConfig.operator} (&ldquo;Lumina&rdquo;, &ldquo;we&rdquo;).
          We decide how the information in Lumina accounts is used, and we are responsible for protecting it.
        </p>
        <p>
          When a school or teacher uses Lumina with their class, the school decides how its pupils&apos; information is used
          for school work, and we follow its instructions for that information.
        </p>
        <p>
          Questions about this policy or your information: <EmailLink email={contacts.privacy} />, or write to us at{" "}
          {legalConfig.postalAddress}.
        </p>
      </>
    ),
  },
  {
    id: "what-we-collect",
    title: "What we collect",
    content: (
      <>
        <h3>From parents and teachers</h3>
        <ul>
          <li>Your name, email address and password. We store the password only in a scrambled form (a hash) that can&apos;t be turned back into it.</li>
          <li>Your language and time zone, if you set them.</li>
          <li>Teachers: school, subjects, grades and a short bio, if you add them, and whether an admin has verified you as a teacher.</li>
          <li>If you turn on two-step verification: the secret shared with your authenticator app (encrypted) and your recovery codes (scrambled like passwords).</li>
          <li>If you sign in with Google, Microsoft or Apple: the account identifier and email address they send us. We never see your password for those services.</li>
        </ul>
        <h3>About children</h3>
        <ul>
          <li>Their name (a first name is enough) and grade, entered by a parent or school.</li>
          <li>A username, and a password or a picture password (three pictures in order), stored scrambled.</li>
          <li>Which parents are linked to them, which classes they are in, and when a parent gave consent.</li>
          <li>We don&apos;t ask children for an email address, phone number, photo, address or school name.</li>
        </ul>
        <h3>From everyone who uses Lumina</h3>
        <ul>
          <li>
            For each signed-in device: when you signed in, when you were last active, the browser and device type (as the
            browser reports it) and the IP address. You see this list under <em>Sign-in and security</em>.
          </li>
          <li>Counts of recent wrong passwords, so we can pause sign-in when someone keeps guessing.</li>
          <li>Short-lived counts of requests per IP address or email address, to slow down attacks and stop email floods.</li>
          <li>A security log of important account changes (password, email address, two-step verification) and of every action by Lumina admins.</li>
        </ul>
        <p>
          We don&apos;t use analytics or advertising tools, so we don&apos;t collect browsing behaviour. See{" "}
          <Link href="/cookies">cookies and device storage</Link> for what is kept in your browser.
        </p>
      </>
    ),
  },
  {
    id: "how-we-use-it",
    title: "How we use it",
    content: (
      <>
        <ul>
          <li>To create and run accounts, sign people in, and show the right courses and reading level.</li>
          <li>To let parents manage their children&apos;s accounts, and admins verify teachers.</li>
          <li>To keep accounts secure: spotting repeated wrong passwords, ending sessions, checking who made important changes.</li>
          <li>
            To send emails you need: confirming your address, resetting a password, confirming an email change, and security
            notices. We don&apos;t send marketing emails.
          </li>
          <li>
            To help when you ask for support. A Lumina admin can then view Lumina as you see it, for at most{" "}
            {d(IMPERSONATION_SESSION_SECONDS)} at a time. They can&apos;t change your password, email or sign-in settings,
            and every visit is recorded.
          </li>
        </ul>
        <p>
          Our legal reasons: to provide the service you asked for (our contract with you); the consent of a parent or
          guardian for children&apos;s accounts, or the school&apos;s authority for class accounts; and our legitimate interest in
          keeping Lumina secure. Where the law requires consent, you can withdraw it at any time.
        </p>
      </>
    ),
  },
  {
    id: "what-we-never-do",
    title: "What we never do",
    content: (
      <ul>
        <li>Show adverts, or use anyone&apos;s information for advertising.</li>
        <li>Sell, rent or trade personal information.</li>
        <li>Give children a public profile, or let them message people they don&apos;t know. Lumina has no chat.</li>
        <li>Build profiles of children for anything other than their learning on Lumina.</li>
      </ul>
    ),
  },
  {
    id: "children",
    title: "Children's information and parental consent",
    content: (
      <>
        <p>
          Lumina is made for children, so we follow the extra rules that protect them (such as COPPA in the United States and
          the Age Appropriate Design Code in the UK).
        </p>
        <ul>
          <li>
            Children under {legalConfig.parentalConsentAge} (or the age set by law where they live) get a Lumina account only
            from a parent or guardian, who confirms they are the child&apos;s parent or guardian and agrees on their behalf, or
            from their school. We record when that consent was given.
          </li>
          <li>A student can connect an account to a parent with a one-time code; the parent then sees it in their family pages.</li>
          <li>Children can&apos;t delete their own account, so an account isn&apos;t lost by accident: a parent or the school can ask us to.</li>
        </ul>
        <p>
          Parents and guardians can see their children&apos;s accounts and change how they sign in under{" "}
          <em>My children</em>. To review the information we hold about your child, correct or delete it, download a copy, or
          stop us collecting more, email <EmailLink email={contacts.privacy} />. We answer within{" "}
          {legalConfig.responseTimes.privacyRequestDays} days and first check that you are the child&apos;s parent or guardian.
        </p>
      </>
    ),
  },
  {
    id: "sharing",
    title: "Who we share it with",
    content: (
      <>
        <p>Only with companies that help us run Lumina, under contracts that let them use the information solely for that:</p>
        <ul>
          {legalConfig.processors.map((processor) => (
            <li key={processor.role}>
              {processor.role}: {processor.name}
            </li>
          ))}
        </ul>
        <p>
          If you choose to sign in with Google, Microsoft or Apple, we send them only the sign-in request; they send us the
          details listed above.
        </p>
        <p>
          We share information with authorities only when the law requires it, or to protect a child from harm. If Lumina
          is ever sold or merged, this policy continues to protect the information, and we&apos;ll tell you first.
        </p>
        <p>Your information is stored in {legalConfig.dataLocation}.</p>
      </>
    ),
  },
  {
    id: "how-long",
    title: "How long we keep it",
    content: (
      <>
        <DataTable
          caption="How long Lumina keeps information"
          columns={["Information", "Kept for"]}
          rows={[
            ["Your account and its details", "Until you delete the account (or ask us to), then deleted straight away"],
            ["Sign-in on a device", `Ends after ${d(SESSION_SECONDS)} without use, ${d(CLASSROOM_SESSION_SECONDS)} after a class-code sign-in, or when you sign out`],
            ["Email links (confirm, reset, change)", `${d(TOKEN_SECONDS.password_reset)} to ${d(TOKEN_SECONDS.email_verification)}, then they stop working (removed a day or so later)`],
            ["Parent link codes", `${d(TOKEN_SECONDS.parent_link)}, or until used`],
            ["Count of wrong passwords on an account", "Until the next successful sign-in or password reset"],
            ["Request counts per IP or email address", "About a day"],
            ["Security log", legalConfig.securityLogRetention],
            ["Backups", `${legalConfig.backupRetention}, then overwritten`],
          ]}
        />
        <p>
          When an account is deleted, its sessions, links, sign-in methods and family and class connections go with it. The
          security log keeps only a note that an account was deleted, without its name or email address. A parent&apos;s
          deletion doesn&apos;t delete their children&apos;s accounts, which may also belong to a school; ask us if you want
          those deleted too.
        </p>
      </>
    ),
  },
  {
    id: "security",
    title: "How we protect it",
    content: (
      <ul>
        <li>Passwords and picture passwords are stored only as strong, one-way hashes (argon2id).</li>
        <li>Two-step verification secrets are encrypted; recovery codes and email links are stored as hashes.</li>
        <li>The sign-in cookie can&apos;t be read by scripts in the page, and on the live site it travels only over encrypted connections.</li>
        <li>Repeated wrong passwords or pictures pause sign-in for that account.</li>
        <li>Adults can turn on two-step verification; signing out everywhere is one click.</li>
        <li>Only Lumina admins can see account details, and what they do is recorded.</li>
      </ul>
    ),
  },
  {
    id: "your-rights",
    title: "Your rights",
    content: (
      <>
        <p>You, and parents for their children, can ask us to:</p>
        <ul>
          <li>show you the information we hold, and give you a copy you can take elsewhere;</li>
          <li>correct it, or delete it;</li>
          <li>stop or limit using it, or stop collecting more about a child.</li>
        </ul>
        <p>
          You can change most details yourself under <em>Your account</em>, and delete an adult account there. For
          everything else, email <EmailLink email={contacts.privacy} />. We answer within{" "}
          {legalConfig.responseTimes.privacyRequestDays} days.
        </p>
        <p>If you are unhappy with our answer, you can complain to {legalConfig.regulator}.</p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    content: (
      <p>
        We&apos;ll update the date at the top when this policy changes. If a change matters for how we use your or your
        child&apos;s information, we&apos;ll email you before it applies, and ask for consent again where the law requires it.
      </p>
    ),
  },
];
