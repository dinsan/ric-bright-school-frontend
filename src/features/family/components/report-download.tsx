import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { familyPaths, REPORT_PERIODS } from "../contract";

/**
 * "Download report (PDF)": a plain GET form, so it works before (or without) JavaScript and the browser
 * saves the file itself. The period is the only choice.
 */
export function ReportDownload({ childId }: { childId: string }) {
  const selectId = `report-period-${childId}`;
  return (
    <form method="get" action={`/api${familyPaths.report(childId)}`} className="flex flex-wrap items-end gap-2">
      <div className="grid gap-1">
        <label htmlFor={selectId} className="text-small font-bold">
          Report period
        </label>
        <Select id={selectId} name="days" defaultValue="30" className="w-44">
          {REPORT_PERIODS.map((days) => (
            <option key={days} value={days}>
              Last {days} days
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" variant="primary">
        <Download aria-hidden />
        Download report (PDF)
      </Button>
    </form>
  );
}
