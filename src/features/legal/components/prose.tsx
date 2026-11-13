import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Long-form text (policies, help): paragraphs, lists, links and small headings with comfortable spacing,
 * built from the design tokens. Line length stays under ~70 characters.
 */
export function Prose({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "max-w-2xl text-body",
        "[&_p]:mt-3 [&_p:first-child]:mt-0 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-6",
        "[&_li]:mt-1.5 [&_li]:pl-1 [&_strong]:font-bold",
        "[&_a]:font-bold [&_a]:text-link [&_a]:underline [&_a]:underline-offset-4",
        "[&_h3]:mt-6 [&_h3]:text-lead [&_h3]:font-extrabold",
        className,
      )}
      {...props}
    />
  );
}

/** A mailto link that shows the address (people often copy it). */
export function EmailLink({ email, children }: { email: string; children?: ReactNode }) {
  return <a href={`mailto:${email}`}>{children ?? email}</a>;
}

/** A simple data table with a caption for screen readers; scrolls sideways on narrow screens. */
export function DataTable({ caption, columns, rows }: { caption: string; columns: string[]; rows: ReactNode[][] }) {
  return (
    <div className="mt-4 max-w-full overflow-x-auto rounded-control border-2 border-line bg-surface" tabIndex={0} role="region" aria-label={caption}>
      <table className="w-full min-w-lg border-collapse text-left text-small">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-surface-sunken">
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col" className="border-b-2 border-line px-3 py-2 font-bold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-line-subtle last:border-b-0 align-top">
              {row.map((cell, cellIndex) =>
                cellIndex === 0 ? (
                  <th key={cellIndex} scope="row" className="px-3 py-2 font-bold">
                    {cell}
                  </th>
                ) : (
                  <td key={cellIndex} className="px-3 py-2">
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
