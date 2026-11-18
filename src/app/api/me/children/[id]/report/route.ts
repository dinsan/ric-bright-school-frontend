import type { NextRequest } from "next/server";
import { z } from "zod";
import { REPORT_PERIODS } from "@/features/family/contract";
import { requireAuth } from "@/server/auth/context";
import { childProgress } from "@/server/family/progress";
import { childReportFileName, childReportPdf } from "@/server/family/report-pdf";
import { parseId, parseQuery } from "@/server/http/validation";
import { type Params, route } from "@/server/http/route";

type Context = Params<{ id: string }>;

const reportQuery = z.object({
  days: z.coerce
    .number()
    .int()
    .refine((value) => (REPORT_PERIODS as readonly number[]).includes(value), `Choose ${REPORT_PERIODS.join(", ")} days.`)
    .default(30),
  inline: z.enum(["1"]).optional(),
});

/**
 * A child's learning report as a PDF (?days=7|30|90, default 30). A plain GET link or form works (the
 * session cookie comes along), so the browser saves it natively; `?inline=1` opens it instead.
 */
export const GET = route(async (request: NextRequest, { params }: Context) => {
  const auth = await requireAuth(request, ["parent"]);
  const { days, inline } = parseQuery(request, reportQuery);
  const report = await childProgress(auth, parseId((await params).id, "That child"), { days });
  const pdf = await childReportPdf(report);
  return new Response(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `${inline ? "inline" : "attachment"}; filename="${childReportFileName(report)}"`,
      "cache-control": "private, no-store",
    },
  });
});
