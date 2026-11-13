/**
 * Facts the legal and trust pages (/privacy, /terms, /cookies, /safety, /contact) depend on.
 *
 * The policies are written from how Lumina works today (what the code stores, for how long, and who can
 * see it). What the code can't know (the company, its address, the law that applies, hosting and email
 * providers) is set here. Until a lawyer has reviewed the texts and these values, `reviewed` stays false
 * and every legal page says it is a draft (TODO: FE-PUB-04).
 */
export const legalConfig = {
  reviewed: false,

  /** The legal entity that runs Lumina. */
  operator: "Lumina (legal entity to be confirmed)",
  postalAddress: "Postal address to be confirmed",
  /** Where account data is stored (country or region of the hosting provider). */
  dataLocation: "to be confirmed with the hosting provider",
  /** The law that governs the terms, and where disputes go. */
  governingLaw: "the laws of the country where Lumina's operator is established (to be confirmed)",
  /** Supervisory authority people can complain to. */
  regulator: "your local data protection authority (for example the Information Commissioner's Office in the UK)",

  contacts: {
    support: "help@lumina.example",
    privacy: "privacy@lumina.example",
    safety: "safety@lumina.example",
  },
  /** How quickly we answer. */
  responseTimes: {
    privacyRequestDays: 30,
    safetyReport: "one working day",
  },

  /** Service providers that handle personal data for Lumina. */
  processors: [
    { role: "Hosting and database", name: "to be confirmed" },
    { role: "Email delivery (sign-up, password and security emails)", name: "to be confirmed" },
  ],
  /** How long database backups are kept before they are overwritten. */
  backupRetention: "35 days (to be confirmed)",
  /** How long the security log (admin actions, password and email changes) is kept. */
  securityLogRetention: "2 years (to be confirmed)",

  /** Adults only for parent and teacher accounts. */
  adultAge: 18,
  /** Under this age a parent or school must set up the account (COPPA: 13; UK/EU: 13 to 16 by country). */
  parentalConsentAge: 13,

  /** Bump `updated` (ISO date) whenever a document changes in substance. */
  documents: {
    privacy: { title: "Privacy policy", updated: "2026-11-12" },
    terms: { title: "Terms of use", updated: "2026-11-12" },
    cookies: { title: "Cookies and device storage", updated: "2026-11-12" },
    safety: { title: "Keeping children safe", updated: "2026-11-12" },
  },
} as const;

export type LegalDocumentId = keyof typeof legalConfig.documents;
