import { Ban, KeyRound, LogOut, MessageCircleHeart, ShieldQuestion, UserX } from "lucide-react";
import Link from "next/link";
import { legalConfig } from "@/config/legal";
import { CLASSROOM_SESSION_SECONDS, IMPERSONATION_SESSION_SECONDS } from "@/server/auth/cookies";
import { PICTURE_LOCKOUT } from "@/server/auth/sign-in";
import type { KidsPoint } from "../components/kids-summary";
import type { LegalSection } from "../components/legal-page";
import { EmailLink } from "../components/prose";
import { formatDuration } from "../device-storage";

const { contacts } = legalConfig;

export const safetyKidsPoints: KidsPoint[] = [
  { icon: KeyRound, text: "Keep your password and your pictures secret. Only share them with your grown-up." },
  { icon: LogOut, text: "When you finish on a shared computer, sign out." },
  { icon: UserX, text: "Never tell people online your address, your school or where you are." },
  { icon: Ban, text: "If someone asks you to keep a secret from your grown-ups, that's not OK. Tell a grown-up." },
  { icon: ShieldQuestion, text: "If something feels strange, scary or wrong, stop and tell a grown-up you trust." },
  { icon: MessageCircleHeart, text: "You won't be in trouble for telling. Telling is brave." },
];

export const safetySections: LegalSection[] = [
  {
    id: "built-in",
    title: "How Lumina keeps children safe",
    content: (
      <ul>
        <li>
          <strong>No chat, no public profiles.</strong> Children can&apos;t message anyone on Lumina, and nobody can look them up.
        </li>
        <li>
          <strong>No adverts, no tracking.</strong> Nothing on Lumina tries to sell to children or follow them around the internet.
        </li>
        <li>
          <strong>No email address needed.</strong> Parents and schools set up children&apos;s accounts; children sign in with a
          username and a password, or, for younger ones, a class code and three secret pictures.
        </li>
        <li>
          <strong>Guessing doesn&apos;t work.</strong> After {PICTURE_LOCKOUT.maxAttempts} wrong picture tries, picture sign-in
          pauses and the child is told to ask their teacher. Password guessing is stopped the same way.
        </li>
        <li>
          <strong>Shared devices sign out.</strong> A class-code sign-in on a classroom device ends after{" "}
          {formatDuration(CLASSROOM_SESSION_SECONDS)}, so the next child doesn&apos;t land in someone else&apos;s account.
        </li>
        <li>
          <strong>Teachers are checked.</strong> A Lumina admin reviews and verifies teacher accounts.
        </li>
        <li>
          <strong>Parents stay in charge.</strong> Only a parent or guardian, who gives consent, or a school can make a
          child&apos;s account, and parents choose how their child signs in.
        </li>
        <li>
          <strong>Staff access is limited and recorded.</strong> When a Lumina admin helps with a problem, they can view an
          account for at most {formatDuration(IMPERSONATION_SESSION_SECONDS)}, can&apos;t change its sign-in, and every action is logged.
        </li>
        <li>
          <strong>Stronger protection for adults.</strong> Teachers and parents can turn on two-step verification, and end
          sessions on other devices with one click.
        </li>
      </ul>
    ),
  },
  {
    id: "parents",
    title: "Tips for parents and guardians",
    content: (
      <ul>
        <li>Set up your child&apos;s sign-in together, and practise it once. For Grades 1 to 3, pictures are usually easiest.</li>
        <li>Choose pictures or a password that others can&apos;t guess, and change them if a friend has seen them (under <em>My children</em>).</li>
        <li>Keep the device in a shared room for young children, and talk about what they are learning.</li>
        <li>
          If you think someone else has signed in to your account, change your password: that signs out every other device.
          Or use &ldquo;sign out everywhere else&rdquo; under <em>Sign-in and security</em>.
        </li>
        <li>Talk about the tips for kids at the top of this page: they work everywhere online, not only on Lumina.</li>
      </ul>
    ),
  },
  {
    id: "teachers",
    title: "Tips for teachers",
    content: (
      <ul>
        <li>Share your class code only with your class, in the classroom. Don&apos;t post it online.</li>
        <li>Tick &ldquo;This is a classroom device&rdquo; only on school devices, never on a child&apos;s own phone or tablet.</li>
        <li>Turn on two-step verification: teacher accounts can see children&apos;s information.</li>
        <li>Follow your school&apos;s safeguarding policy, and report any concern to your safeguarding lead as well as to us.</li>
      </ul>
    ),
  },
  {
    id: "report",
    title: "Report a concern",
    content: (
      <>
        <p>
          If something on Lumina worries you (an account you don&apos;t recognise, content that isn&apos;t right for children,
          a security problem), email <EmailLink email={contacts.safety} />. Say what happened and, if you can, when. We reply
          within {legalConfig.responseTimes.safetyReport} and take urgent reports first.
        </p>
        <p>
          <strong>If a child is in danger right now, call your local emergency number.</strong> Lumina is not an emergency
          service.
        </p>
        <p>
          Children and young people can also talk to a helpline, free and in confidence: for example Childline in the UK
          (0800 1111) or the Childhelp National Child Abuse Hotline in the United States (1-800-422-4453).
        </p>
      </>
    ),
  },
  {
    id: "more",
    title: "More about privacy",
    content: (
      <p>
        What we keep about children, and the rights parents have, are in our <Link href="/privacy">privacy policy</Link>.
        What Lumina stores in your browser is on <Link href="/cookies">cookies and device storage</Link>.
      </p>
    ),
  },
];
