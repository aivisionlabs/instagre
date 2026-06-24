import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { X } from "lucide-react";

export type CoachMarkStep =
  | "home"
  | "browse-tour"
  | "browse-flags"
  | "mastered-tab"
  | "tough-tab"
  | "tough-nut-drill";

const STORAGE_KEY = "instagre_coach_marks";
const TOOLTIP_MAX_WIDTH = 320;
const VIEWPORT_PAD = 16;
const TOOLTIP_GAP = 12;
/** Conservative estimate so we flip/clamp before the card leaves the viewport. */
const TOOLTIP_EST_HEIGHT = 260;

function readSeen(): Set<CoachMarkStep> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as CoachMarkStep[]);
  } catch {
    return new Set();
  }
}

export function hasSeenCoachMark(step: CoachMarkStep): boolean {
  return readSeen().has(step);
}

export function markCoachMarkSeen(step: CoachMarkStep) {
  const seen = readSeen();
  seen.add(step);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen]));
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function getAppShellBounds(): { left: number; right: number } {
  const shell = document.querySelector<HTMLElement>("[data-app-shell]");
  if (shell) {
    const rect = shell.getBoundingClientRect();
    return { left: rect.left, right: rect.right };
  }

  const width = Math.min(600, window.innerWidth);
  const left = (window.innerWidth - width) / 2;
  return { left, right: left + width };
}

function resolveTarget(target: string): Rect | null {
  const el = document.querySelector<HTMLElement>(target);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  // Element not laid out yet (e.g. coach mark mounted before first paint).
  if (rect.width === 0 && rect.height === 0) return null;
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

function layoutTooltip(
  hole: Rect,
  placement: "top" | "bottom",
  bounds: { left: number; right: number },
) {
  const maxWidth = bounds.right - bounds.left - VIEWPORT_PAD * 2;
  const width = Math.min(TOOLTIP_MAX_WIDTH, maxWidth);
  const targetCenterX = hole.left + hole.width / 2;
  const idealLeft = targetCenterX - width / 2;
  const minLeft = bounds.left + VIEWPORT_PAD;
  const maxLeft = bounds.right - VIEWPORT_PAD - width;
  const left = Math.min(Math.max(idealLeft, minLeft), maxLeft);

  const spaceBelow =
    window.innerHeight - VIEWPORT_PAD - (hole.top + hole.height + TOOLTIP_GAP);
  const spaceAbove = hole.top - TOOLTIP_GAP - VIEWPORT_PAD;

  let effectivePlacement = placement;
  if (
    placement === "bottom" &&
    spaceBelow < TOOLTIP_EST_HEIGHT &&
    spaceAbove > spaceBelow
  ) {
    effectivePlacement = "top";
  } else if (
    placement === "top" &&
    spaceAbove < TOOLTIP_EST_HEIGHT &&
    spaceBelow > spaceAbove
  ) {
    effectivePlacement = "bottom";
  }

  // Neither side has room — pin below the header area, scrollable if needed.
  if (
    spaceBelow < TOOLTIP_EST_HEIGHT &&
    spaceAbove < TOOLTIP_EST_HEIGHT
  ) {
    return {
      left,
      width,
      top: VIEWPORT_PAD,
      maxHeight: window.innerHeight - VIEWPORT_PAD * 2,
      overflowY: "auto" as const,
    };
  }

  if (effectivePlacement === "top") {
    return {
      left,
      width,
      bottom: window.innerHeight - hole.top + TOOLTIP_GAP,
    };
  }

  const idealTop = hole.top + hole.height + TOOLTIP_GAP;
  const maxTop = window.innerHeight - VIEWPORT_PAD - TOOLTIP_EST_HEIGHT;
  return {
    left,
    width,
    top: Math.min(idealTop, Math.max(VIEWPORT_PAD, maxTop)),
  };
}

function rectsEqual(a: Rect | null, b: Rect | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.top === b.top &&
    a.left === b.left &&
    a.width === b.width &&
    a.height === b.height
  );
}

interface CoachMarkSpotlightProps {
  /** CSS selector for the element to highlight */
  target: string;
  title: string;
  body: ReactNode;
  /** Where the tooltip sits relative to the highlight */
  placement?: "top" | "bottom";
  onDismiss: () => void;
  /** Optional icon shown in the tooltip header */
  icon?: ReactNode;
  /** Primary button label (defaults to "Got it") */
  primaryLabel?: string;
  /** Skip the entire tour (shown as a text link) */
  onSkip?: () => void;
  /** 0-based step index — shows progress dots when stepCount is also set */
  stepIndex?: number;
  stepCount?: number;
}

export function CoachMarkSpotlight({
  target,
  title,
  body,
  placement = "bottom",
  onDismiss,
  icon,
  primaryLabel = "Got it",
  onSkip,
  stepIndex,
  stepCount,
}: CoachMarkSpotlightProps) {
  const [rect, setRect] = useState<Rect | null>(() => resolveTarget(target));

  useEffect(() => {
    let raf = 0;
    let attempts = 0;

    const update = () => {
      setRect((prev) => {
        const next = resolveTarget(target);
        return rectsEqual(prev, next) ? prev : next;
      });
      return resolveTarget(target);
    };

    const retryUntilFound = () => {
      const found = update();
      attempts += 1;
      if (!found && attempts < 30) {
        raf = requestAnimationFrame(retryUntilFound);
      }
    };

    retryUntilFound();

    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [target]);

  if (!rect) return null;

  const pad = 8;
  const hole = {
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };

  const tooltip = layoutTooltip(hole, placement, getAppShellBounds());
  const tooltipOnTop = "bottom" in tooltip;

  return createPortal(
    <div className="fixed inset-0 z-[70] pointer-events-none">
      {/* Dimmed overlay with spotlight hole */}
      <div
        className="absolute rounded-2xl pointer-events-auto ring-2 ring-white/90 ring-offset-2 ring-offset-transparent transition-all duration-200"
        style={{
          top: hole.top,
          left: hole.left,
          width: hole.width,
          height: hole.height,
          boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.72)",
        }}
        onClick={onDismiss}
      />

      {/* Tooltip — fixed + box-border so width includes padding */}
      <motion.div
        initial={{ opacity: 0, y: tooltipOnTop ? 8 : -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed box-border bg-white rounded-2xl shadow-2xl p-5 pointer-events-auto"
        style={tooltip}
      >
        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-3 right-3 text-gray-300 hover:text-gray-500 cursor-pointer"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="space-y-2 pr-4">
          {icon && (
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              {icon}
            </div>
          )}
          <h3 className="font-serif text-lg font-black text-text-primary leading-tight">
            {title}
          </h3>
          <p className="text-sm text-text-secondary leading-relaxed break-words">
            {body}
          </p>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="mt-4 w-full btn-3d bg-primary text-white py-2.5 rounded-xl font-bold text-sm cursor-pointer"
        >
          {primaryLabel}
        </button>

        {(onSkip || (stepCount != null && stepCount > 1)) && (
          <div className="mt-3 flex items-center justify-between gap-3">
            {onSkip ? (
              <button
                type="button"
                onClick={onSkip}
                className="text-xs font-bold text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                Skip tour
              </button>
            ) : (
              <span />
            )}
            {stepCount != null && stepCount > 1 && stepIndex != null && (
              <div className="flex gap-1.5">
                {Array.from({ length: stepCount }, (_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${
                      i === stepIndex ? "w-4 bg-primary" : "w-1.5 bg-gray-200"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>,
    document.body,
  );
}

export interface CoachMarkTourStep {
  target: string;
  title: string;
  body: ReactNode;
  placement?: "top" | "bottom";
}

interface CoachMarkTourProps {
  steps: CoachMarkTourStep[];
  onComplete: () => void;
}

/** Multi-step spotlight tour — one CTA at a time with Next / Skip. */
export function CoachMarkTour({ steps, onComplete }: CoachMarkTourProps) {
  const [index, setIndex] = useState(0);
  const step = steps[index];
  if (!step) return null;

  const isLast = index === steps.length - 1;

  return (
    <CoachMarkSpotlight
      target={step.target}
      title={step.title}
      body={step.body}
      placement={step.placement}
      primaryLabel={isLast ? "Got it" : "Next"}
      stepIndex={index}
      stepCount={steps.length}
      onSkip={onComplete}
      onDismiss={() => (isLast ? onComplete() : setIndex((i) => i + 1))}
    />
  );
}

/** Whether the user has finished the Browse tab onboarding tour. */
export function hasSeenBrowseTour(): boolean {
  return hasSeenCoachMark("browse-tour") || hasSeenCoachMark("browse-flags");
}

export function markBrowseTourSeen() {
  markCoachMarkSeen("browse-tour");
  markCoachMarkSeen("browse-flags");
}
