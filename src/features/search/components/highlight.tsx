import { highlightParts } from "../query";

/** `text` with the parts that match the search terms marked. Renders strings only, never HTML. */
export function Highlight({ text, terms }: { text: string; terms: string[] }) {
  return (
    <>
      {highlightParts(text, terms).map((part, index) =>
        part.match ? (
          <mark key={index} className="rounded-sm bg-accent px-0.5 text-accent-fg">
            {part.text}
          </mark>
        ) : (
          part.text
        ),
      )}
    </>
  );
}
