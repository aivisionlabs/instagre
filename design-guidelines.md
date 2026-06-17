# WordCrack Design System Guidelines

This document outlines the core principles and standards for the WordCrack application, combining universal design best practices with the specific "Academic Immersive" visual language.

## 1. Design Principles
*   **Academic Immersion:** Prioritize focus and scholarship through elegant typography and minimal distractions.
*   **Consistency:** Use reusable components and patterns to reduce cognitive load.
*   **Accessibility:** Ensure all elements meet WCAG 2.1 AA standards. Touch targets for mobile should be at least 44x44px.
*   **Ergonomics:** Position key actions (Learned, Tough Nut) in the lower-right "thumb zone" for one-handed mobile use.

## 2. Foundation (Design Tokens)

### Color Palette
*   **Primary (Study Blue):** #1a73e8 — Used for headers, progress bars, and primary actions.
*   **Surface:** #f7f9fb — The main background for cards and screens.
*   **Semantic Colors:**
    *   *Learned (Emerald):* Used for completed words and success states.
    *   *Tough Nut (Peanut Brown):* #8B4513 — Used for difficult words and flagged content.
*   **Neutral Palette:** High-contrast grays and whites for text and container backgrounds.

### Typography
*   **Heading / Word Font:** **Playfair Display** (Serif). Use for the primary word on cards to convey academic authority.
*   **UI / Body Font:** **Inter** or standard Sans-Serif. Use for definitions, metadata, and interface labels for maximum legibility.
*   **Scale:**
    *   Hero Word: 48px - 64px (Playfair Display Bold)
    *   Subheadings: 18px - 20px (Sans-Serif Semi-bold)
    *   Body Text: 16px (Sans-Serif Regular)
    *   Caption/Label: 12px - 14px (Sans-Serif Medium)

### Spacing & Grid
*   **Base Unit:** 8px grid system.
*   **Corner Radius:** 8px (Round Eight) for all cards, buttons, and containers.
*   **Elevation:** Subtle shadows for cards to separate them from the light-blue surface background.

## 3. Component Architecture

### The Immersive Flashcard
*   **Structure:** Full-screen card spanning from the header to the bottom navigation.
*   **Interaction:** 3D Y-axis rotation (0.6s ease-in-out) on tap to reveal back-side details.
*   **Navigation:** Vertical swipe to cycle through word cards.

### Header Navigation
*   **Branding:** "WordCrack" text in the top left.
*   **Progress:** Integrated linear progress bar showing current letter mastery.
*   **Letter Selector:** A-Z button in the top right that triggers a blurred grid overlay.

### Floating Actions
*   **State Indicators:** Floating action icons in the bottom right corner for "Learned" (Checkmark) and "Tough Nut" (Peanut).

## 4. Interaction & Motion
*   **Duration:** 300ms for standard transitions; 600ms for the 3D card flip.
*   **Easing:** Standard 'ease-out' for entering elements and 'ease-in' for exiting.
*   **Feedback:** Haptic feedback on card flip and state toggles.

## 5. Implementation Standards
*   **Naming:** Use semantic tokens (e.g., `var(--color-primary)`, `var(--font-academic)`) rather than descriptive ones.
*   **Localization:** Design for text expansion in different languages, particularly for definitions.
