"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/** The `digest` matches the error in the server logs. Production hides the real message, so this is what support needs. */
function errorDigest(error: unknown): string | undefined {
  if (error instanceof Error && "digest" in error && typeof error.digest === "string") {
    return error.digest;
  }
  return undefined;
}

export interface PageErrorProps {
  /** Server Component errors arrive as an `Error` with a `digest`; client code can throw anything. */
  error: unknown;
  /** Re-fetches and re-renders the segment (unlike `reset`, which only re-renders). */
  retry: () => void;
}

/** Body of the error.tsx boundaries. */
export function PageError({ error, retry }: PageErrorProps) {
  const digest = errorDigest(error);

  useEffect(() => {
    // Report the error. Swap this for the error-reporting service once one is chosen.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-gutter py-16 sm:py-24">
      <EmptyState
        illustration="error"
        headingLevel={1}
        title={<span className="text-title">This page did not load</span>}
        description={
          <>
            <p>Something went wrong on our side. Try again, and if it keeps happening, come back in a few minutes.</p>
            {digest && (
              <p className="mt-3 text-small">
                If you contact support, quote this reference:{" "}
                <code className="rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-fg">{digest}</code>
              </p>
            )}
          </>
        }
        action={
          <Button variant="primary" onClick={() => retry()}>
            Try again
          </Button>
        }
      />
    </div>
  );
}
