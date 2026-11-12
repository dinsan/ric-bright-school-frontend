import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

// Reference pages for the team: available in `npm run dev` only, never in production builds.
export default function DesignSystemLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}
