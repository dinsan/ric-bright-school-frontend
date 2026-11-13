import Link from "next/link";
import { legalConfig } from "@/config/legal";
import type { LegalSection } from "../components/legal-page";
import { EmailLink } from "../components/prose";

const { contacts, adultAge, parentalConsentAge } = legalConfig;

export const termsInShort = [
  `Parent and teacher accounts are for adults (${adultAge} or over). Children use Lumina through a parent, guardian or school.`,
  "Keep your password (and your child's pictures) secret, and use Lumina to learn and teach, nothing else.",
  "The courses belong to Lumina and its authors; you can use them for learning and in class.",
  "You can delete your account whenever you like. We can suspend accounts that put others, especially children, at risk.",
];

export const termsSections: LegalSection[] = [
  {
    id: "about",
    title: "About these terms",
    content: (
      <>
        <p>
          These terms are the agreement between you and {legalConfig.operator} (&ldquo;Lumina&rdquo;, &ldquo;we&rdquo;) for using
          Lumina. By creating an account or using Lumina you accept them. A parent or guardian accepts them for their child; a
          school accepts them for the pupils it adds.
        </p>
        <p>
          How we handle personal information is explained in our <Link href="/privacy">privacy policy</Link>, and how we keep
          children safe on <Link href="/safety">keeping children safe</Link>.
        </p>
      </>
    ),
  },
  {
    id: "who-can-use",
    title: "Who can use Lumina",
    content: (
      <ul>
        <li>Parent, guardian and teacher accounts are for adults aged {adultAge} or over.</li>
        <li>
          Children get a student account from a parent or guardian, or from their school. Children under {parentalConsentAge}{" "}
          (or the age set by law where they live) can&apos;t create an account themselves.
        </li>
        <li>Teachers may add only pupils they are responsible for, with their school&apos;s permission.</li>
      </ul>
    ),
  },
  {
    id: "your-account",
    title: "Your account",
    content: (
      <ul>
        <li>Give accurate details, and keep them up to date.</li>
        <li>Keep your password, recovery codes and your child&apos;s picture password secret. Don&apos;t share accounts.</li>
        <li>Use two-step verification if you are a teacher or an admin: you can see children&apos;s information.</li>
        <li>
          If you think someone else has used your account, change your password and choose &ldquo;sign out everywhere
          else&rdquo; under <em>Sign-in and security</em>, then tell us at <EmailLink email={contacts.support} />.
        </li>
      </ul>
    ),
  },
  {
    id: "children",
    title: "Children's accounts",
    content: (
      <p>
        Parents and guardians are responsible for their children&apos;s use of Lumina at home, and schools in class. Choose a
        sign-in your child can manage, help them keep it secret, and talk with them about using the internet safely. Our{" "}
        <Link href="/safety">safety page</Link> has tips.
      </p>
    ),
  },
  {
    id: "acceptable-use",
    title: "Using Lumina well",
    content: (
      <>
        <p>Use Lumina to learn and to teach. Don&apos;t:</p>
        <ul>
          <li>try to get into accounts, classes or information that aren&apos;t yours;</li>
          <li>guess class codes, link codes or passwords, or get around the limits that protect sign-in;</li>
          <li>copy the service or its content in bulk (scraping), or sell access to it;</li>
          <li>interfere with Lumina, for example by overloading it or testing its security without our written permission;</li>
          <li>add anything unlawful, harmful or inappropriate for children wherever Lumina lets you add text.</li>
        </ul>
        <p>
          Found a security problem? Tell us at <EmailLink email={contacts.safety} /> and don&apos;t share it until we have fixed it.
        </p>
      </>
    ),
  },
  {
    id: "content",
    title: "Our content",
    content: (
      <p>
        The courses and everything else on Lumina belong to Lumina or to the people who made them for us. You may use them
        for your own learning, your children&apos;s, and teaching your classes. Please don&apos;t republish or sell them.
      </p>
    ),
  },
  {
    id: "availability",
    title: "Availability and changes",
    content: (
      <p>
        We work to keep Lumina running and your information safe, but we can&apos;t promise it will always be available or
        free of mistakes. We improve Lumina all the time, so features may change. If we introduce paid features, their price
        and terms will be shown before you pay, and nothing is charged without your agreement.
      </p>
    ),
  },
  {
    id: "ending",
    title: "Ending your account",
    content: (
      <>
        <p>
          You can delete a parent or teacher account at any time under <em>Your account</em>. For a child&apos;s account,
          email <EmailLink email={contacts.privacy} />.
        </p>
        <p>
          We may suspend or close an account that breaks these terms, or to protect children or other users. We&apos;ll tell
          you why unless the law or someone&apos;s safety stops us.
        </p>
      </>
    ),
  },
  {
    id: "liability",
    title: "Our responsibility to you",
    content: (
      <p>
        Nothing in these terms limits rights you have by law, or our responsibility for harm we cause through negligence
        or fraud. Apart from that, we are not responsible for losses that we could not reasonably foresee, or that are
        caused by things outside our control.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    content: (
      <p>
        If we change these terms in a way that matters, we&apos;ll email you before the change applies. If you don&apos;t
        agree, you can delete your account before then.
      </p>
    ),
  },
  {
    id: "law",
    title: "Law and disputes",
    content: (
      <p>
        These terms are governed by {legalConfig.governingLaw}. If something goes wrong, please contact us first at{" "}
        <EmailLink email={contacts.support} />: most problems are solved quickly that way.
      </p>
    ),
  },
];
