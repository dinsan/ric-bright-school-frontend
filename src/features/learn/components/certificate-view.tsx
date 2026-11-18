import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import type { Certificate } from "../contract";

/**
 * The certificate on screen: the same layout and wording as the PDF (src/server/learning/certificate-pdf.ts),
 * so the preview is what prints. A4 landscape proportions; scales with its container. Fixed light colours
 * on purpose (it is a paper document), in every theme.
 */
export function CertificateView({ certificate, className }: { certificate: Certificate; className?: string }) {
  return (
    <div
      className={cn("relative aspect-[297/210] w-full overflow-hidden rounded-card border-2 border-line [container-type:inline-size]", className)}
      style={{
        backgroundColor: "#f5f8ff",
        backgroundImage: "linear-gradient(#e1e9f8 1px, transparent 1px), linear-gradient(90deg, #e1e9f8 1px, transparent 1px)",
        backgroundSize: "2.9cqw 2.9cqw",
      }}
    >
      <div
        className="absolute flex flex-col items-center text-center"
        style={{ inset: "6.7cqw 5.2cqw 5.4cqw 4.3cqw", background: "#ffffff", border: "0.36cqw solid #0e1a3b", boxShadow: "1cqw 1cqw 0 #0e1a3b", color: "#0e1a3b" }}
      >
        <div className="absolute" style={{ inset: "1.9cqw", border: "0.15cqw solid #2547f5" }} />
        <div className="relative flex h-full w-full flex-col items-center" style={{ padding: "4.3cqw 6cqw 3cqw" }}>
          <p className="flex items-center font-extrabold" style={{ gap: "1cqw", fontSize: "2.6cqw" }}>
            <span aria-hidden className="inline-flex items-center justify-center" style={{ width: "3.3cqw", height: "3.3cqw", background: "#2547f5", border: "0.25cqw solid #0e1a3b" }}>
              <span style={{ width: "1.4cqw", height: "1.4cqw", borderRadius: "999px", background: "#ffd23f", border: "0.18cqw solid #0e1a3b" }} />
            </span>
            Lumina
          </p>
          <p className="font-extrabold uppercase" style={{ color: "#2547f5", fontSize: "1.8cqw", marginTop: "2.8cqw", letterSpacing: "0.05em" }}>
            Certificate of completion
          </p>
          <p style={{ color: "#4a5679", fontSize: "1.9cqw", marginTop: "2.4cqw" }}>This certifies that</p>
          <p className="font-extrabold leading-tight wrap-break-word" style={{ fontSize: certificate.student_name.length > 28 ? "3.4cqw" : "5.2cqw", marginTop: "1.6cqw" }}>
            {certificate.student_name}
          </p>
          <span aria-hidden style={{ width: "35cqw", height: "0.7cqw", background: "#ffd23f", marginTop: "0.6cqw" }} />
          <p style={{ color: "#4a5679", fontSize: "1.9cqw", marginTop: "2.2cqw" }}>has completed every lesson of</p>
          <p className="font-extrabold leading-tight wrap-break-word" style={{ fontSize: certificate.course_title.length > 40 ? "2.4cqw" : "3.5cqw", marginTop: "1.2cqw" }}>
            {certificate.course_title}
          </p>
          <p style={{ color: "#4a5679", fontSize: "1.55cqw", marginTop: "1cqw" }}>
            Grade {certificate.grade_level} · {certificate.subject_name} · {certificate.lessons_count} {certificate.lessons_count === 1 ? "lesson" : "lessons"}
          </p>
          <div className="mt-auto flex w-full justify-between text-left" style={{ fontSize: "1.5cqw" }}>
            <div style={{ width: "25cqw", borderTop: "0.18cqw solid #0e1a3b", paddingTop: "0.5cqw" }}>
              <p className="font-extrabold">{formatDate(certificate.issued_at)}</p>
              <p style={{ color: "#4a5679", fontSize: "1.2cqw" }}>Date</p>
            </div>
            <div style={{ width: "25cqw", borderTop: "0.18cqw solid #0e1a3b", paddingTop: "0.5cqw" }}>
              <p className="font-extrabold">{certificate.code}</p>
              <p style={{ color: "#4a5679", fontSize: "1.2cqw" }}>Certificate number</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
