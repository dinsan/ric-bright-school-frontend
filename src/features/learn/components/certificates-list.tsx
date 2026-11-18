"use client";

import { Award, Download, Eye, FileText } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button, ButtonLink, buttonVariants } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { certificatePdfUrl } from "../api";
import type { Certificate } from "../contract";
import { useCertificates } from "../hooks";
import { CertificateView } from "./certificate-view";

/**
 * Certificates (FE-STU-08): every certificate earned, a preview of each (the same layout as the PDF),
 * and the PDF to download or open. Private to the student: there is no public page with a child's name.
 */
export function CertificatesList() {
  const certificates = useCertificates();
  const [preview, setPreview] = useState<Certificate | null>(null);

  if (certificates.isPending) {
    return (
      <div className="grid gap-4 md:grid-cols-2" role="status" aria-label="Loading your certificates">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (certificates.isError) {
    return (
      <EmptyState
        illustration="error"
        role="alert"
        title="Your certificates didn't load"
        description={certificates.error.message}
        action={<Button onClick={() => certificates.refetch()}>Try again</Button>}
      />
    );
  }
  if (certificates.data.length === 0) {
    return (
      <EmptyState
        illustration="celebrate"
        title="No certificates yet"
        description="Finish every lesson of a course and its certificate appears here, ready to download and print."
        action={<ButtonLink href="/learn/courses">Go to my courses</ButtonLink>}
      />
    );
  }

  return (
    <>
      <ul className="grid gap-6 md:grid-cols-2">
        {certificates.data.map((certificate) => (
          <li key={certificate.id} id={`certificate-${certificate.id}`} className="scroll-mt-24">
            <Card className="h-full gap-4">
              {/* A picture of the certificate; the Preview button below opens it large. */}
              <CertificateView certificate={certificate} />
              <div className="grid gap-1">
                <CardTitle as="h2" className="flex items-center gap-2">
                  <Award aria-hidden className="size-5 shrink-0" />
                  {certificate.course_title}
                </CardTitle>
                <p className="text-small text-fg-muted">
                  Grade {certificate.grade_level} · {certificate.subject_name} · earned {formatDate(certificate.issued_at)} · {certificate.code}
                </p>
                {certificate.course_slug && (
                  <Link href={`/learn/courses/${certificate.course_slug}`} className="w-fit text-small font-bold underline underline-offset-4 hover:no-underline">
                    Go back to the course
                  </Link>
                )}
              </div>
              <div className="mt-auto flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setPreview(certificate)}>
                  <Eye aria-hidden />
                  Preview
                </Button>
                {/* Plain links: the server answers with the PDF file. */}
                <a href={certificatePdfUrl(certificate.id)} download className={buttonVariants({ variant: "primary", size: "sm" })}>
                  <Download aria-hidden />
                  Download PDF
                </a>
                <a href={certificatePdfUrl(certificate.id, { inline: true })} target="_blank" rel="noopener" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  <FileText aria-hidden />
                  Open PDF <span className="sr-only">(opens in a new tab)</span>
                </a>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      <Dialog open={preview !== null} onOpenChange={(open) => !open && setPreview(null)}>
        {preview && (
          <DialogContent title={preview.course_title} description={`Certificate ${preview.code}, earned ${formatDate(preview.issued_at)}.`} className="max-w-4xl">
            {/* Readable on phones too: at least 36rem wide, scrolling sideways (reachable with the keyboard). */}
            <div role="region" aria-label="The certificate (scroll sideways on small screens)" tabIndex={0} className="overflow-x-auto rounded-card">
              <CertificateView certificate={preview} className="min-w-[36rem] sm:min-w-0" />
            </div>
            <p className="text-small text-fg-muted sm:hidden">Scroll sideways to see all of it, or open the PDF to zoom in.</p>
            <DialogFooter>
              <DialogClose asChild>
                <Button>Close</Button>
              </DialogClose>
              <a href={certificatePdfUrl(preview.id, { inline: true })} target="_blank" rel="noopener" className={buttonVariants({ variant: "secondary" })}>
                <FileText aria-hidden />
                Open PDF <span className="sr-only">(opens in a new tab)</span>
              </a>
              <a href={certificatePdfUrl(preview.id)} download className={buttonVariants({ variant: "primary" })}>
                <Download aria-hidden />
                Download PDF
              </a>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
