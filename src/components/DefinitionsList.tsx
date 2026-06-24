import { formatDefinitions } from "../utils/wordContent";

type DefinitionsListVariant = "front" | "detail" | "inline";

interface DefinitionsListProps {
  definitions: string[];
  variant?: DefinitionsListVariant;
  /** Show 1, 2, 3… prefixes when there are multiple senses. Default true. */
  numbered?: boolean;
  className?: string;
}

/** Section heading — includes count when there are multiple senses. */
export function DefinitionsHeading({ count }: { count: number }) {
  return (
    <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-text-secondary">
      {count === 1 ? "Definition" : `Definitions · ${count}`}
    </h5>
  );
}

/**
 * Renders one or many word senses. Numbering kicks in at 2+; front-face
 * scrolls when the list would crowd the flashcard.
 */
export function DefinitionsList({
  definitions,
  variant = "detail",
  numbered = true,
  className = "",
}: DefinitionsListProps) {
  if (!definitions.length) return null;

  if (variant === "inline") {
    return (
      <span className={className}>{formatDefinitions(definitions)}</span>
    );
  }

  const showNumbers = numbered && definitions.length > 1;
  const isFront = variant === "front";
  const isDense = definitions.length > 2;

  const listClass = [
    className,
    isFront && isDense
      ? "max-h-[min(30vh,168px)] overflow-y-auto overscroll-contain pr-1 -mr-1"
      : "",
    showNumbers ? "space-y-2" : definitions.length > 1 ? "space-y-1.5" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const textClass = isFront
    ? isDense
      ? "text-[15px] text-text-secondary"
      : "text-lg text-text-secondary"
    : "text-[15px] text-text-primary";

  return (
    <div className={listClass} role="list" aria-label="Definitions">
      {definitions.map((definition, index) => (
        <div
          key={index}
          role="listitem"
          className={`flex gap-2.5 leading-relaxed ${showNumbers ? "items-start" : ""}`}
        >
          {showNumbers && (
            <span
              className={
                isFront
                  ? "shrink-0 min-w-[1.25rem] font-extrabold tabular-nums text-text-primary"
                  : "shrink-0 w-6 h-6 mt-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-extrabold flex items-center justify-center tabular-nums"
              }
              aria-hidden
            >
              {isFront ? `${index + 1}.` : index + 1}
            </span>
          )}
          <p className={`${textClass} min-w-0 flex-1`}>{definition}</p>
        </div>
      ))}
    </div>
  );
}

interface WordEtymologyProps {
  etymology: string;
  className?: string;
}

export function WordEtymology({ etymology, className = "" }: WordEtymologyProps) {
  if (!etymology.trim()) return null;

  return (
    <section className={`space-y-1.5 ${className}`}>
      <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-text-secondary">
        Etymology
      </h5>
      <p className="text-[15px] leading-relaxed text-text-primary">{etymology}</p>
    </section>
  );
}
