---
name: Scoreboard Precision
colors:
  surface: '#101418'
  surface-dim: '#101418'
  surface-bright: '#36393f'
  surface-container-lowest: '#0b0e13'
  surface-container-low: '#191c21'
  surface-container: '#1d2025'
  surface-container-high: '#272a2f'
  surface-container-highest: '#32353a'
  on-surface: '#e1e2e9'
  on-surface-variant: '#c0c7d4'
  inverse-surface: '#e1e2e9'
  inverse-on-surface: '#2e3036'
  outline: '#8a919d'
  outline-variant: '#404752'
  surface-tint: '#a2c9ff'
  primary: '#a2c9ff'
  on-primary: '#00315b'
  primary-container: '#4da3ff'
  on-primary-container: '#003866'
  inverse-primary: '#0060a9'
  secondary: '#4ae176'
  on-secondary: '#003915'
  secondary-container: '#00b954'
  on-secondary-container: '#004119'
  tertiary: '#ffb4aa'
  on-tertiary: '#690003'
  tertiary-container: '#ff7566'
  on-tertiary-container: '#750004'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d3e4ff'
  primary-fixed-dim: '#a2c9ff'
  on-primary-fixed: '#001c38'
  on-primary-fixed-variant: '#004881'
  secondary-fixed: '#6bff8f'
  secondary-fixed-dim: '#4ae176'
  on-secondary-fixed: '#002109'
  on-secondary-fixed-variant: '#005321'
  tertiary-fixed: '#ffdad5'
  tertiary-fixed-dim: '#ffb4aa'
  on-tertiary-fixed: '#410001'
  on-tertiary-fixed-variant: '#930006'
  background: '#101418'
  on-background: '#e1e2e9'
  surface-variant: '#32353a'
typography:
  display-hero:
    fontFamily: Black Ops One
    fontSize: 56px
    fontWeight: '400'
    lineHeight: 60px
    letterSpacing: 0.02em
  display-hero-mobile:
    fontFamily: Black Ops One
    fontSize: 36px
    fontWeight: '400'
    lineHeight: 40px
    letterSpacing: 0.02em
  display-counter:
    fontFamily: Black Ops One
    fontSize: 80px
    fontWeight: '400'
    lineHeight: 80px
    letterSpacing: 0em
  display-counter-mobile:
    fontFamily: Black Ops One
    fontSize: 48px
    fontWeight: '400'
    lineHeight: 48px
    letterSpacing: 0em
  stamp-verdict:
    fontFamily: Black Ops One
    fontSize: 24px
    fontWeight: '400'
    lineHeight: 28px
    letterSpacing: 0.05em
  headline-lg:
    fontFamily: Archivo
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
  headline-md:
    fontFamily: Archivo
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: Archivo
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Archivo
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Archivo
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Archivo
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  ui-medium:
    fontFamily: Archivo
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  measure-val:
    fontFamily: IBM Plex Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: -0.01em
  measure-val-bold:
    fontFamily: IBM Plex Mono
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: -0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-tablet: 1.5rem
  gutter-desktop: 2rem
  margin: 1rem
  margin-tablet: 1.5rem
  margin-desktop: 2.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

The design system merges the immediate visual punch of an arena scoreboard with the grounded clarity of clinical movement coaching. It speaks to competitive functional fitness athletes and certified movement judges who require instant, undisputed clarity under physical duress or high-stakes judging. 

The aesthetic is built on high contrast, discipline, and restraint:
- **Atmosphere:** Deep obsidian surfaces paired with clear, readable typography. No decorative neon halos, no ambient outer glows, and zero futuristic telemetry jargon.
- **Copy Voice:** Grounded, human, and direct. Use sentence case across headers and interface labels. Avoid buzzwords like "telemetry pipeline", "confidence rating", or "neural calibration". State the movement condition plainly (e.g., "Hip crease below knee", "Target contact missed").
- **Visual Weight:** Industrial precision. Thick display numbers anchor visual hierarchies, while measured values occupy neutral monospaced tokens. Surfaces remain strictly structural and flat.

## Colors

The palette operates in strict dark mode to isolate motion and text against deep environmental contrast. Colors are functionally bound:

- **Surfaces & Layout:**
  - `Background` (`#0A0C0F`): Deep baseline tone.
  - `Surface` (`#12151A`): Primary container panels and video feed surrounds.
  - `Raised` (`#191D24`): Overlay cards, inspect drawers, and popovers.
  - `Border` (`#262B34`): Subtle structural boundary applied at 1px thickness.
- **Typography:**
  - `Text Primary` (`#ECEEF1`): High-legibility off-white for all primary values, headings, and labels.
  - `Text Muted` (`#8B93A0`): Secondary metadata, measurement units, and structural keys.
- **Interactive:**
  - `Accent` (`#4DA3FF`): Reserved strictly for interactive inputs, toggles, scrubber playheads, and focused states. Never use the accent color as a verdict or status indicator.
- **Verdict System (Restricted Use):**
  - `Proper` (`#22C55E`): Confirmed rep standard met.
  - `No-rep` (`#F04438`): Movement standard failed.
  - `Can't judge` (`#F5A524`): Obscured target, athlete turned away, or missing frame. Must always render with a 45° diagonal repeating pattern fill (`repeating-linear-gradient(45deg, #F5A524 0, #F5A524 4px, transparent 4px, transparent 8px)`) across indicators and badges to maintain accessibility for color-deficient users.

## Typography

The typographic hierarchy enforces immediate split-second scanning:

1. **Display & Stamps (`Black Ops One`):** Reserved exclusively for large scoreboard rep counters, landing hero headlines, and verdict stamps (`REP ✓`, `NO REP`, `CAN'T JUDGE`). Do not use this font for standard page titles or navigational items.
2. **Headings & Body (`Archivo`):** Set strictly in sentence case. Headings leverage the `600` weight to give deliberate presence without aggressive capitalization. Body copy relies on `400` weight, with UI labels and action states using `500`.
3. **Biomechanic Readings (`IBM Plex Mono`):** Applied exclusively to physical metrics, comparison deltas, and frame indices (e.g., `hip 0.11 L above knee · needs ≥ −0.03 L`). Never apply monospaced styling to human UI instructions or narrative copy.

## Layout & Spacing

The layout model uses a responsive fluid grid system organized around visual scrutiny of video and data:

- **Desktop (1024px+):** 12-column grid with `2.5rem` margins and `2rem` gutters. Splits video scrutiny (8 columns) from the timeline and breakdown ledger (4 columns).
- **Tablet (768px - 1023px):** 8-column grid with `1.5rem` margins and gutters. Stacks video above analytical panels.
- **Mobile (< 768px):** 4-column fluid layout with `1rem` margins and gutters. Scoreboard counters stick to the top viewport; analysis tabs collapse into vertical cards.

Component spacing obeys strict multiples of 4px. Maintain open visual breathing room (`space-lg` to `space-xl`) around data sets to prevent cognitive fatigue during rapid rep reviews.

## Elevation & Depth

This system avoids drop shadows and neon backglows. Spatial order is achieved strictly through deliberate surface tiers and borders:

- **Level 0 (Base Canvas):** `#0A0C0F`. The foundational floor.
- **Level 1 (Card & Module Layer):** `#12151A` bordered with 1px `#262B34`. Houses video elements, tables, and metric summaries.
- **Level 2 (Popovers, Inspect Drawers & Dialogs):** `#191D24` outlined with 1px `#262B34`. Elevated over Level 1 with no box-shadow, using high container tone contrast and sharp borders to isolate the boundary.
- **Interactive Scrims:** Modals and bottom sheets utilize an opaque dark scrim (`#0A0C0F` at 85% opacity) with no blur filter to maintain performance and clear legibility.

## Shapes

The geometric structure relies on disciplined 12px radii (`rounded-md` equivalent to `0.75rem` or token level `2`). 

- **Outer Shells:** Cards, video viewports, dialogs, and segmented toolbars use `12px` roundedness.
- **Inner Controls:** Standard buttons, chips, and input text fields match the `12px` radius for uniformity.
- **Pill Exceptions:** Status badges and verdict stamps use a tighter `4px` or full pill radius (`9999px`) to distinguish meta labels from structural clickable components.
- **Outlines:** All structural cards, fields, and badges carry a uniform 1px `#262B34` border. Never apply multi-layer borders or bevels.

## Components

All components follow the Lucide outline icon set (1.5px stroke width). Every verdict element must display an **Icon + Word + Color** tri-factor for accessibility and quick identification.

### 1. Verdict Stamps & Badges
- **Structure:** 1px solid border matching the verdict color, dark background fill tinted at 10% opacity, paired with an icon and `Black Ops One` or `Archivo 600` text.
- **Proper:** Checkmark icon (`Check`) + `"REP ✓"` + `#22C55E`.
- **No-rep:** Cross icon (`X`) + `"NO REP"` + `#F04438`.
- **Can't Judge:** Alert icon (`AlertTriangle`) + `"CAN'T JUDGE"` + `#F5A524`. A repeating 45° diagonal hatched background (`#F5A524` over transparent) fills the badge interior.

### 2. Buttons
- **Rule:** Exactly **one** primary action button per screen (e.g., "Confirm review" or "Record set").
- **Primary Button:** Background `#4DA3FF`, text `#0A0C0F`, font `Archivo 500`, radius `12px`, padding `12px 24px`. Hover: brightness `1.08`. Active: scale `0.98`.
- **Secondary Button:** Surface `#191D24`, border 1px `#262B34`, text `#ECEEF1`.
- **Destructive Button:** Surface `#12151A`, border 1px `#F04438`, text `#F04438`.

### 3. Metric Breakdown Cards
- **Container:** Background `#12151A`, border 1px `#262B34`, 12px radius, padding `16px`.
- **Header:** Human-readable sentence case title in `Archivo 600` (`#ECEEF1`) with a Lucide icon.
- **Reading Row:** Left-aligned human observation (`Archivo 400`, `#8B93A0`), right-aligned exact measurement value (`IBM Plex Mono`, `#ECEEF1`).
  - Example: `Knee depth` | `hip 0.11 L above knee · needs ≥ −0.03 L`

### 4. Input Fields
- **Container:** Height `48px`, background `#12151A`, border 1px `#262B34`, radius `12px`, padding `0 16px`.
- **Text:** `Archivo 400` at 14px (`#ECEEF1`).
- **Focus:** 1px border `#4DA3FF`. Zero glow ring.
- **Placeholder:** `#8B93A0`.

### 5. Chips & Filters
- **Resting:** Background `#12151A`, border 1px `#262B34`, text `#8B93A0`, radius `8px`.
- **Active:** Background `#191D24`, border 1px `#4DA3FF`, text `#ECEEF1`.

### 6. Timeline Scrubber & Video Annotations
- **Scrubber Bar:** Track `#191D24`, active segment `#4DA3FF`, 4px height.
- **Frame Markers:** Tick marks coloured by verdict (`#22C55E` for rep peak, `#F04438` for fault frame).
- **Target Crosshair:** 1px dashed lines in `#8B93A0` indicating the wall target height (10 ft / 9 ft) without animated radar overlays or faux tracking circles.