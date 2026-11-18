import type { NextRequest } from "next/server";
import { requireAuth } from "@/server/auth/context";
import { certificateFileName, certificatePdf } from "@/server/learning/certificate-pdf";
import { getCertificate } from "@/server/learning/service";
import { parseId } from "@/server/http/validation";
import { type Params, route } from "@/server/http/route";

type Context = Params<{ certificateId: string }>;

/**
 * The certificate as a PDF download. A plain GET link works (the session cookie comes along), so the
 * browser saves it natively; `?inline=1` opens it in the browser's viewer instead.
 */
export const GET = route(async (request: NextRequest, { params }: Context) => {
  const auth = await requireAuth(request, ["student"]);
  const certificate = await getCertificate(auth, parseId((await params).certificateId, "That certificate"));
  const pdf = await certificatePdf(certificate);
  const disposition = request.nextUrl.searchParams.get("inline") === "1" ? "inline" : "attachment";
  return new Response(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `${disposition}; filename="${certificateFileName(certificate)}"`,
      "cache-control": "private, no-store",
    },
  });
});
