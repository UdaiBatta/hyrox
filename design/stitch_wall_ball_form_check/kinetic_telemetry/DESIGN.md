---
name: Kinetic Telemetry
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
  display-xl:
    fontFamily: Barlow Condensed
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 52px
    letterSpacing: 0.02em
  display-lg:
    fontFamily: Barlow Condensed
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: 0.02em
  headline-lg:
    fontFamily: Barlow Condensed
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: 0.01em
  headline-md:
    fontFamily: Barlow Condensed
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: 0.01em
  headline-sm:
    fontFamily: Barlow Condensed
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 22px
    letterSpacing: 0.01em
  title-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  telemetry-lg:
    fontFamily: JetBrains Mono
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.02em
  telemetry-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: -0.01em
  telemetry-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.06em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
  space-2xl: 2rem
---

## Brand & Style

This design system establishes a high-performance visual language balancing tournament scoreboard immediacy with surgical biomechanical analysis. Designed desktop-first for coaches, judges, and athletes scrutinizing high-speed movement repetitions, the aesthetic rejects extraneous decoration in favor of raw informational density, tactical contrast, and calibrated focus.

The stylistic direction blends **Technical Minimalism** with **Sports Telemetry**:
- **Utilitarian & Decisive:** Interfaces behave like mission control. Every visual element exists to validate biomechanics or deliver rep-by-rep verdicts.
- **Strict Visual Hierarchy:** Chromatic energy is rigorously gated. The interface remains calm and dark until real-time telemetry or verdict engines fire.
- **Race-Day Precision:** High-contrast data fields, monospaced coordinate systems, and dense card layouts echo stadium timing equipment while retaining the polished precision of modern engineering tools.

## Colors

The palette operates in strict dark mode to reduce eye fatigue across multi-hour video review sessions and provide an obsidian canvas where tracking points, skeletal vectors, and telemetry metrics achieve maximum contrast.

### Palette Architecture
- **Base Canvas (`#0A0C0F`):** Deep abyssal black. Used for the viewport underlay and master container canvases.
- **Surface (`#12151A`):** Structural panels, sidebars, dock rails, and standard view containers.
- **Raised Surface (`#191D24`):** Elevated cards, modal dialogs, flyout sheets, hover states, and active scrubber overlays.
- **Structural Border (`#262B34`):** Crisp 1px perimeter definition ensuring clear module boundaries in ultra-dark environments without casting heavy drop shadows.
- **Text & Content:** `#ECEEF1` serves as the primary readable layer for high contrast, while `#8B93A0` formats sub-labels, measurement units, disabled states, and metadata timestamps.
- **Interface Accent (`#4DA3FF`):** Reserved exclusively for neutral interactive UI—primary triggers, selection states, scrub heads, active timeline spans, and focus rings.

### Movement Verdict Tokens (Restricted Use)
To maintain immediate cognitive recognition during rapid scoring cycles, verdict colors are strictly prohibited from general decorative or interactive usage:
- **Proper Rep (`#22C55E`):** Depth reached, extension completed, target hit.
- **No-Rep (`#F04438`):** Failed standard, shallow depth, incomplete lock-out, missed target line.
- **Indeterminate / Can't Judge (`#F5A524`):** Occluded joints, camera artifact, insufficient light. Rendered with a repeating 45-degree diagonal hash texture (alternating `#F5A524` and transparent stripes at 6px intervals) to provide fail-safe clarity for color-blind officials and quick scanning.

## Typography

The type system deploys three distinct typographical families optimized for fast situational awareness and computational clarity:

1. **Barlow Condensed (600/700):** Provides monumental visibility for tall rep tallies, frame numbers, elapsed timers, and scoreboard-style section headers. Its athletic, condensed rhythm packs maximum tabular data into tight lateral dimensions. All tabular figures (`font-variant-numeric: tabular-nums`) must be active for numeric displays.
2. **Inter (400/500/600):** The primary workhorse for standard system navigation, inspector controls, athlete profile metadata, guidelines, and form fields. It provides neutral, uncompromised legibility across varying monitor sizes.
3. **JetBrains Mono (400/500/600):** Dedicated exclusively to telemetry reads, joint angles (`94.2°`), spatial deviations (`-0.11 L`), timecodes (`00:01:24.08`), and machine-vision confidence outputs. Monospacing eliminates horizontal layout shift as values stream during playback.

## Layout & Spacing

This design system is calibrated desktop-first for wide split-screen review stations, typically 1080p, 1440p, or 4K monitors:

- **Layout Structure:** Multi-pane workspace architecture. A standard view organizes around an interactive primary media viewport (video canvas with skeletal vector overlays), anchored by a persistent vertical telemetry rail on the right (320px–420px wide) and a scrub/timeline tray pinned along the lower horizontal axis.
- **Rhythm & Grid:** Built on an intentional 4px base increment. Gutters and paddings prioritize information density, grouping metrics tightly to minimize cross-screen eye travel.
- **Density Scaling:** Default density is compact. Components use 8px (`space-sm`) and 12px (`space-md`) interior paddings to allow simultaneous inspection of video, angle trajectories, and cumulative rep lists without vertical viewport clipping.
- **Reflow Rules:** When collapsed to tablet or compact displays, secondary telemetry rails fold into slide-over sheets, granting 100% of the canvas to the video player and primary judgment status bar.

## Elevation & Depth

Spatial layering relies entirely on **low-contrast containment outlines** and **tonal plate stacking**, keeping visual noise minimal:

- **Level 0 (Canvas):** `#0A0C0F`. The foundational underlayment holding all sub-panels.
- **Level 1 (Docked Containers & Toolbars):** `#12151A` with a continuous `1px solid #262B34` border. Contains the primary video stage, side panels, and master header.
- **Level 2 (Active Cards & Floating Widgets):** `#191D24` backed by `1px solid #262B34`. Used for rep cards, metric modules, telemetry readouts, and dropdown flyouts.
- **Level 3 (Modal Sheets & Inspection Dialogs):** `#191D24` bordered with `#262B34` and augmented with a subtle, non-intrusive ambient shadow (`0 12px 32px -4px rgba(0, 0, 0, 0.65)`).
- **No Heavy Shadows:** Soft skeuomorphic drop shadows are banned on static workspace surfaces. Planes are articulated purely through the interaction of `#12151A`, `#191D24`, and the `#262B34` structural line.
- **Focus & Target Depths:** Focused or selected elements introduce a clean, tight accent halo: `box-shadow: 0 0 0 1px #4DA3FF`.

## Shapes

The interface embraces a precise, modern industrial geometry:
- **Base Geometry:** Standard interactive components (buttons, input boxes, metric cards, status badges) adhere strictly to an 8px to 10px corner radius (`0.5rem` to `0.625rem`), providing a refined, tactical silhouette without sliding into juvenile circularity.
- **Large Panels & Dialogs:** Flyout sheets, modal dialogs, and video staging cards scale to 12px (`rounded-lg`, ~`0.75rem`).
- **Inner Micro-Elements:** Progress track ticks, timeline scrub indicators, and mini-chips use 4px (`rounded-xs`) or 6px. Full pill shapes are explicitly forbidden for interactive buttons, reserved only for small, high-density telemetry status markers.
- **Iconography:** Lucid, crisp, linear line icons (Lucide-style) set at a uniform 1.5px to 2px stroke, adhering to the 16px and 20px bounding box grid.

## Components

### Buttons & Interactive Controls
- **Primary Button:** `#4DA3FF` solid background with `#0A0C0F` bold Inter text. On hover, background lightens slightly (`#66B0FF`). On press, scales to `0.98`. Focus ring: 2px offset `#4DA3FF`.
- **Secondary / Ghost Button:** `#191D24` background, `1px solid #262B34`, `#ECEEF1` text. Hover shifts background to `#262B34`.
- **Destructive Action:** `#191D24` background, `1px solid #F04438`, `#F04438` text.

### Scoreboard Verdict Badges & Rep Chips
- **Proper Badge:** Surface `#12151A`, text `#22C55E`, border `1px solid #22C55E/40`, background tint `rgba(34, 197, 94, 0.1)`. Font: Barlow Condensed 700.
- **No-Rep Badge:** Surface `#12151A`, text `#F04438`, border `1px solid #F04438/40`, background tint `rgba(240, 68, 56, 0.1)`. Font: Barlow Condensed 700.
- **Can't Judge Badge:** Boundary `1px solid #F5A524`, foreground `#F5A524`, featuring a repeating CSS linear gradient texture:
  `background: repeating-linear-gradient(45deg, rgba(245, 165, 36, 0.15), rgba(245, 165, 36, 0.15) 6px, rgba(18, 21, 26, 0.9) 6px, rgba(18, 21, 26, 0.9) 12px);`

### Metric Cards & Telemetry Tiles
- **Structure:** Background `#12151A` (or `#191D24` if nested), border `1px solid #262B34`, rounded 10px.
- **Header:** Uppercase 10px Inter muted text (`#8B93A0`) tracking `0.06em`, paired with a secondary micro-icon.
- **Data Readout:** JetBrains Mono 20px `#ECEEF1`. Delta readouts (e.g., `-0.11 L`) sit directly adjacent in JetBrains Mono 12px with dynamic neutral tinting.

### Timeline & Video Scrubber
- **Track Base:** 6px height, background `#191D24`, border `1px solid #262B34`, rounded 3px.
- **Rep Segment Intervals:** Discrete colored bands mapped on the timeline (`#22C55E` for valid reps, `#F04438` for no-reps).
- **Scrub Head:** Crisp 2px vertical bar in `#4DA3FF`, crowned with an 8px diamond or 10px rounded handle holding frame-exact numbers.

### Input Fields & Selectors
- **Base Input:** Background `#0A0C0F`, border `1px solid #262B34`, rounded 8px. Text `#ECEEF1` with `#8B93A0` placeholder.
- **Active / Focus State:** Border transitions to `#4DA3FF` with zero drop shadow blur.

### Flyout Sheets & Modals
- **Surface:** `#191D24`, perimeter defined by `1px solid #262B34`.
- **Header Separator:** Full-width 1px dividing rule using `#262B34`. No soft gradient dividers.