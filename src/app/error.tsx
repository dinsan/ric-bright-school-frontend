"use client";

import { PageError, type PageErrorProps } from "@/components/feedback/page-error";

// Catches errors outside the route groups' own boundaries (for example in a group layout).
export default function RootError(props: PageErrorProps) {
  return <PageError {...props} />;
}
