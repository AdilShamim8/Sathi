# UI Context

Product: **Sathi (সাথী)**. The Origin app is a *visual reference only*, not our brand.
This file is the single source of truth for every visual decision.
If it is silent on something, ask. Never invent a visual decision.

## Decision Record

- **Theme: dark-first, dark-only for this release.** There is no light mode. Decided from the
  team's Origin reference. It reduces glare on low-end OLED phones and makes text-over-glass
  contrast easier to control.
- Every component is token-only, so a light theme could be added later by overriding tokens.
  No light theme is built or tested now.
- This file replaces the earlier light-only liquid-glass spec.
- Unit 19a (tokens and glass system) may start only after this decision is also recorded in
  `progress-tracker.md`.

## Theme

A calm, private, dark fintech interface in the iOS Human Interface Guidelines style, running
inside an Android Capacitor WebView.

- **Mood:** sophisticated, quiet, trustworthy. It must feel like a patient coach, never a
  trading terminal and never a casino.
- **Surfaces:** layered dark surfaces. Depth comes from surface lightness and hairline borders,
  not heavy shadows.
- **Glass (frosted material):** only on *floating chrome* (tab bar, scrolled header, bottom
  sheets, chat composer, toasts). Content cards are always solid.
- **Accent:** one cool cyan, used sparingly for the primary action and the AI voice. Everything
  else is neutral.
- **Not allowed:** SF Symbols, Apple fonts, other products' assets or copy, stock-chart
  aesthetics, countdown or urgency styling.
- **Colour never carries meaning alone.** Every state also uses an icon and a text label.

## Colors

All components use these tokens. No hardcoded hex, rgb or rgba outside the token file.

### Core tokens

| Role                 | CSS Variable           | Value                      | Notes |
| -------------------- | ---------------------- | -------------------------- | ----- |
| Page background      | `--bg-base`            | `#000000`                  | Status bar area, splash, behind everything |
| Grouped background   | `--bg-grouped`         | `#121214`                  | Main scroll body of each screen |
| Surface (cards)      | `--bg-surface`         | `#1C1C1E`                  | Cards, list rows, insight banners |
| Raised surface       | `--bg-surface-raised`  | `#2C2C2E`                  | Inputs, chips, nested controls, solid fallback for glass |
| Scrim                | `--bg-scrim`           | `rgba(0,0,0,0.55)`         | Behind sheets. Never blurred |
| Primary text         | `--text-primary`       | `#FFFFFF`                  | Headings, figures, body |
| Secondary text       | `--text-secondary`     | `#AEAEB2`                  | Subtitles, supporting copy |
| Muted text           | `--text-muted`         | `#8E8E93`                  | Timestamps, micro-labels. Never on `--bg-surface-raised` |
| Disabled / decorative| `--text-disabled`      | `#636366`                  | Disabled controls and decoration only. Never for readable content |
| Text on accent       | `--text-on-accent`     | `#00131C`                  | Text/icons on cyan buttons |
| Primary accent       | `--accent-primary`     | `#64D2FF`                  | Primary button, links, selected tab, AI voice |
| Accent tint          | `--accent-tint`        | `rgba(100,210,255,0.14)`   | AI message bubbles, selected chips |
| Border               | `--border-default`     | `rgba(255,255,255,0.10)`   | 0.5pt hairlines on cards and rows |
| Border strong        | `--border-strong`      | `rgba(255,255,255,0.18)`   | Focus ring base, inputs on focus |
| Success / surplus    | `--state-success`      | `#30D158`                  | Goal on track, surplus. Always with icon + text |
| Caution / pressure   | `--state-caution`      | `#FF9F0A`                  | Cash-flow pressure, assumptions needing a look |
| Error                | `--state-error`        | `#FF453A`                  | **System and validation errors only** |
| Info                 | `--state-info`         | `#64D2FF`                  | Neutral notices, demo-data label |

### Colour rules (responsible by design)

1. **Red is for system errors only** (failed request, invalid input). It is never used for
   spending, balances, cash-outs, budget status or the user's behaviour.
2. Money pressure uses `--state-caution` (amber) with an icon and a plain sentence, for example
   "এই সপ্তাহে খরচ বেশি" / "This week's outflow is the largest".
3. `--state-success` marks real progress only. No celebration styling around spending.
4. No gradient text, neon glows or animated colour pulses on figures.
5. **AI voice:** assistant bubbles use `--accent-tint` plus a Sparkles icon. User bubbles use
   `--bg-surface-raised`.

### Contrast (computed estimates, re-verify with a tool in Unit 19a)

| Pair | Approx. ratio | Verdict |
| ---- | ------------- | ------- |
| `--text-primary` on `--bg-surface` | ~16:1 | pass |
| `--text-secondary` on `--bg-surface` | ~7.6:1 | pass |
| `--text-muted` on `--bg-surface` | ~5.2:1 | pass AA |
| `--text-muted` on `--bg-surface-raised` | ~4.3:1 | **fails. Use secondary there** |
| `--text-disabled` on any surface | ~2.7:1 | decorative only |
| `--accent-primary` on `--bg-surface` | ~9.8:1 | pass |
| `--text-on-accent` on `--accent-primary` | ~11:1 | pass |
| `--state-caution` on `--bg-surface` | ~8:1 | pass |
| `--state-error` on `--bg-surface` | ~4.7:1 | pass AA |

**Text over glass:** the glass fill must stay at or above the opacity in the Glass section so
`--text-primary` keeps at least 7:1 over any content scrolling beneath. Check this on the real phone.

### Evidence label chips

Every insight shows what kind of statement each figure is (architecture invariant 5). Chips are
neutral and differ by **icon and text**, never by colour alone.

| Label (EN / বাংলা) | Icon | Meaning |
| ------------------ | ---- | ------- |
| Data / তথ্য | `Database` | Computed from the user's (simulated) transactions |
| Prediction / পূর্বাভাস | `TrendingUp` | Model output, always shown as a range plus a probability |
| Assumption / ধারণা | `Info` | A named, configurable assumption |
| Generated text / এআই লেখা | `Sparkles` | Wording produced or paraphrased by the LLM or a template |

Style: `--bg-surface-raised`, `--text-secondary`, radius `chip`, 12px minimum text. Prediction
and Generated chips may add `--accent-tint`. Tapping a chip opens the "Why am I seeing this?" sheet.

## Typography

All fonts are **bundled in the app**, loaded locally (`next/font/local` or committed `woff2`
files). No CDN. The app must render correctly in airplane mode.

| Role | Font | Variable |
| ---- | ---- | -------- |
| UI text, Latin | Inter (variable, Latin subset) | `--font-sans` |
| UI text, Bangla | Hind Siliguri 400/500/600/700 (Bengali + Latin subset) | `--font-bangla` |
| Debug and code only | system `ui-monospace` stack (nothing bundled) | `--font-mono` |

`--font-sans` stack: `Inter, "Hind Siliguri", system-ui, sans-serif`. Bangla glyphs fall
through to Hind Siliguri. When the app language is Bangla, `--font-bangla` leads the stack
and the Bangla line-height modifier applies.

### Type scale (rem, root 16px, mirrors iOS Dynamic Type roles)

| Role | Size | Line height | Weight | Use |
| ---- | ---- | ----------- | ------ | --- |
| `display` | 2rem | 1.2 | 700 | Hero figure (API `display` string) |
| `title-1` | 1.5rem | 1.3 | 700 | Screen titles |
| `title-2` | 1.25rem | 1.35 | 600 | Section headers |
| `headline` | 1.0625rem | 1.4 | 600 | Card titles, row titles |
| `body` | 1rem | 1.5 | 400 | Default text |
| `callout` | 0.9375rem | 1.5 | 400 | Supporting text |
| `footnote` | 0.8125rem | 1.4 | 400 | Timestamps, hints |
| `caption` | 0.75rem | 1.35 | 500 | Chips only. **12px is the minimum anywhere** |

### Typography rules

- **Bangla:** multiply line height by 1.15, use no letter-spacing, no uppercase transform and no
  synthetic italic. Never use fixed-height text containers.
- **Font scale:** sizes are `rem` only, never `px`. The UI must remain usable at **200%** system
  font scale. Verify on the device that Android's font scale actually reaches the WebView. If it
  does not, add the Capacitor text-zoom plugin inside `web/lib/native/`.
- **Numbers:** the UI renders the API's `display` strings verbatim (Bangla or Latin digits, ৳,
  grouping). Use `font-variant-numeric: tabular-nums` where the font supports it, and never
  rely on it for Bangla digits.
- Only bundled weights are used. Never request a weight that is not bundled.

## Border Radius

Radii are tokens in CSS and mapped to named Tailwind classes. Ad hoc `rounded-[..px]` is not allowed.

| Context | Token | Value | Class |
| ------- | ----- | ----- | ----- |
| Badges, chips, evidence labels | `--radius-chip` | 8px | `rounded-chip` |
| Buttons, inputs, list rows | `--radius-control` | 14px | `rounded-control` |
| Cards / panels | `--radius-card` | 20px | `rounded-card` |
| Bottom sheets / modals (top corners) | `--radius-sheet` | 28px | `rounded-sheet` |
| Tab bar pill, avatars, toggles | `--radius-pill` | 999px | `rounded-pill` |

## Spacing, Elevation, Hairlines

- **Spacing:** 4px grid. Tokens `--space-1` (4px) through `--space-8` (32px). Screen horizontal
  padding is `--space-4` (16px). Card gap is `--space-3` (12px). Section gap is `--space-6` (24px).
- **Hairline:** `--hairline: 0.5px`. On displays under 2x pixel ratio, an override sets it to
  1px so borders do not vanish.
- **Elevation:** solid surfaces use the surface ladder (`--bg-grouped` → `--bg-surface` →
  `--bg-surface-raised`) plus a hairline. The only shadow token is `--shadow-float` for floating
  chrome: `0 8px 24px rgba(0,0,0,0.45)`.
- **Touch targets:** at least 48x48px for every tappable element, with at least 8px between targets.

## Glass System

Glass is a **tokenised material**, applied only through the shared classes `.glass` and
`.glass-solid-fallback`. No ad hoc `backdrop-filter` anywhere.

### Where glass is allowed

Tab bar, header (only after the content scrolls under it), bottom sheets, chat composer, toasts.
**Cards, list rows, charts and forms are always solid.**

### Effects levels

Set as `data-effects="full|reduced|off"` on `<html>`.

| Level | Blur | Fill | Behaviour |
| ----- | ---- | ---- | --------- |
| `full` | `--glass-blur-full` 24px, saturate 160% | `rgba(28,28,30,0.62)` | Top-edge highlight, hairline border |
| `reduced` (**default**) | `--glass-blur-reduced` 8px | `rgba(28,28,30,0.86)` | Same border, no saturate |
| `off` | none | solid `--bg-surface-raised` | Fully usable. Every screen must work here |

- A Settings toggle controls the level.
- `prefers-reduced-transparency` forces `off`.
- Default is `reduced` until `docs/perf.md` shows `full` is smooth on the demo phone.

### Glass rules

1. **Never animate `backdrop-filter`.** Animate `opacity` and `transform` only.
2. **At most two blur layers on screen.** When a sheet is open, the tab bar and header switch
   to the solid fallback.
3. The scrim behind a sheet is never blurred.
4. Always provide the solid fallback for low-end devices.
5. Glass text stays `--text-primary` or `--text-secondary`. Muted text on glass is not allowed.

## Motion and Haptics

- **Tokens:** `--dur-fast` 120ms, `--dur-base` 200ms, `--dur-slow` 320ms, easing
  `cubic-bezier(0.2, 0, 0, 1)`.
- **Allowed motion:** sheet slide-in (transform), fades, tab cross-fade, skeleton shimmer
  (opacity only).
- **Forbidden:** count-up or interpolated numbers, bouncing alerts, shake, pulsing urgency,
  confetti, auto-scrolling carousels.
- **Money and probabilities appear by fade only.** Never animate, interpolate or reformat them.
- `prefers-reduced-motion` disables all non-essential motion.
- **Haptics** are light selection feedback only (tab change, chip select, mic start), through
  `web/lib/native/`. There are no haptics on caution or error states and no repeated or heavy haptics.

## Component Library

- **shadcn/ui on Tailwind, with Radix primitives.**
- Components live in `web/components/ui/` and are **generated by the CLI** (`npx shadcn add ...`).
  **Do not hand-edit them.** They are protected files. Restyle them only through the CSS variables above.
- App-specific components live in `web/components/sathi/`. They compose `ui/` primitives and
  use tokens only.
- The Tailwind theme (`theme.extend` for v3, or `@theme` for v4, matching the pinned version)
  maps the CSS variables to named utilities such as `bg-surface`, `text-secondary`,
  `rounded-card` and `border-default`. Raw colour utilities (`bg-black`, `text-gray-400`) and
  arbitrary values (`bg-[#1C1C1E]`) are not allowed.

### Required `sathi/` components

| Component | Purpose |
| --------- | ------- |
| `MoneyText` | Renders an API `display` string verbatim. Never formats or animates |
| `EvidenceChips` + `WhySheet` | The four chips and the "Why am I seeing this?" sheet (data, prediction range and probability, assumptions, model version) |
| `DemoBadge` | Persistent, non-dismissible "Demo data, not live" / "ডেমো তথ্য, লাইভ নয়" pill when bundled data is shown |
| `StateView` | One component for loading, waking-up, offline, empty, error and success |
| `GlassSheet`, `GlassTabBar`, `GlassHeader`, `GlassComposer`, `Toast` | The only places the glass classes are used |
| `ForecastBand` | Cash-flow range chart (see Data Visualisation) |
| `TradeoffCard` | One savings-plan option. All options have equal visual weight |
| `AmountConfirm` | "Did you mean ৳৩০,০০০?" confirm or edit card for typed and spoken amounts |
| `VoiceButton` | Mic with idle, listening, error and unavailable states |

A chart library may be added only in the unit that needs it, and recorded in `docs/third_party.md`.

## Layout Patterns

- **Shell:** a single-column, mobile-first app. Bottom tab bar with at most 5 tabs. The tab set
  is defined in `project-overview.md`, which wins on any conflict. The web build centres a
  480px-wide column on desktop.
- **Safe areas:** edge-to-edge with `env(safe-area-inset-*)` on the header, tab bar and
  composer. Light status-bar icons on `--bg-base`. Content bottom padding equals tab bar height
  (56px) plus the bottom inset plus 16px.
- **Header:** iOS large-title style that collapses on scroll. The `GlassHeader` surface appears
  only once content scrolls under it.
- **Cards:** `--bg-surface`, `rounded-card`, hairline border, `--space-4` padding. Cards are
  never glass.
- **Sheets:** bottom sheet with a grabber, up to 90% height, `rounded-sheet` top corners,
  `--bg-scrim` behind, `GlassSheet`. **Android back closes the topmost sheet first** and exits
  only from the root tab.
- **Lists:** grouped rows with hairline separators, at least 56px tall, with a chevron when tappable.
- **Segmented control:** for language (বাংলা / English), persona and range pickers.
- **Chat (Sathi tab):**
  - Message list, with assistant bubbles on `--accent-tint` plus the Sparkles icon.
  - Starter chips for the four official journeys sit above the composer and must work with no LLM.
  - `GlassComposer` is pinned above the keyboard (verify keyboard resize on the phone) and holds
    the mic button, the text field and send.
  - Each assistant message shows its evidence chips beneath it.
  - Spoken or typed amounts always pass through `AmountConfirm` before use.
- **Plan options (savings):** two or three `TradeoffCard`s side by side or stacked. **None is
  pre-selected, and none is visually promoted.** The user decides. Each shows the contribution,
  the time, the trade-off, and `P(goal met)` as a range from the API.
- **Navigation:** plain push and pop. No dark-pattern patterns (no modals blocking exit, no
  confirm-shaming buttons, no hidden decline).

## Data Visualisation

- **Forecast = band plus median:** show the p10 to p90 range as a soft band and the median as a
  line, with the probability stated in text next to the chart.
- **Never a single-point forecast.**
- **Always provide a text summary** of the chart for screen readers and for glanceability.
- **Weekly outflow bars:** the largest week is marked with `--state-caution` plus a label, not
  colour alone.
- **Chart colours come from tokens.** Historic data is neutral, forecast is `--accent-primary`,
  pressure is `--state-caution`. Never red or green alone to mean good or bad.
- Chart axis and value text is rendered from API `display` strings. Charts do not compute money.
- No animated drawing of values. Fade-in only.

## Screen States (every data view must implement all six)

| State | Treatment |
| ----- | --------- |
| Loading | Skeleton rows on `--bg-surface-raised` with an opacity-only shimmer |
| Waking up | Calm message, "সার্ভার জেগে উঠছে… কয়েক সেকেন্ড লাগতে পারে" / "Waking the server up…". Falls back to demo data after the timeout |
| Offline | Bundled demo data with the persistent `DemoBadge`. Never a blank screen |
| Empty | Icon, one plain sentence, one clear next action |
| Error | `--state-error` icon and text, a retry action, and a way back. No technical jargon and no blame |
| Success | Quiet confirmation (check icon and text). No confetti |

## Copy and Tone (Track 03 "empower, do not manipulate")

- **Bangla first, English toggle.** All user-facing strings live in locale files, never inline in components.
- **Voice:** plain, warm, factual. Describe the pattern, then give options. Do not instruct or scold.
- **Banned:** urgency ("hurry", "last chance", "don't miss out"), guilt or shaming ("you wasted",
  "you failed", "overspending!"), fear, streak-loss pressure, upsell and fee-hiding language,
  and any copy that nudges the user to spend more.
- **Required where relevant:** "You decide" framing on plans, and a visible "why" on every insight.
- **Out-of-scope requests** (loans, investment advice, moving money): fixed refusal template
  with a gentle redirect, and no styling that suggests the app can do it.
- **Credit readiness (if built):** informational only. Never worded as an approval, denial or offer.

## Icons

**Lucide** (`lucide-react`), stroke-based only. SF Symbols are Apple-only and are not used.

| Context | Size | Stroke |
| ------- | ---- | ------ |
| Inline with text, chips | 16px (`h-4 w-4`) | 1.75 |
| Buttons, list rows | 20px (`h-5 w-5`) | 1.75 |
| Tab bar | 24px (`h-6 w-6`) | 1.75 (selected: 2) |

- Import icons individually (named imports) so unused icons are not bundled.
- Icon-only buttons need an `aria-label` in the active language.
- Icons accompany state colours. They never replace the text label.

## Accessibility

- Tap targets are at least 48px. Visible focus ring uses `--border-strong` with an
  `--accent-primary` outline.
- Text contrast meets WCAG AA, including text on glass.
- Usable at 200% font scale and at a 360x640 minimum viewport.
- TalkBack labels exist in both languages for tabs, icon buttons, chips and charts.
- Caution and success are never conveyed by colour alone.
- `prefers-reduced-motion` and `prefers-reduced-transparency` are honoured.

## App Shell (Android / Capacitor)

- Splash background is `--bg-base`. The status bar is light-content on a transparent or
  `--bg-base` background.
- Navigation bar colour matches `--bg-base`.
- All Capacitor plugins (haptics, speech, status bar, keyboard, back button, text zoom) are
  imported only in `web/lib/native/`, each with a web fallback.
- The built bundle must contain no CDN font or script references.

## Visual QA Checklist (every UI unit, on the real demo phone, latest CI APK)

- [ ] Checked at effects `full`, `reduced` and `off`, with screenshots kept
- [ ] Checked in Bangla and English, at 100% and 200% font scale
- [ ] Airplane mode: demo data, `DemoBadge` visible, no crash
- [ ] All six states render
- [ ] No hardcoded colour, radius, spacing, shadow or blur added
- [ ] Contrast checked, including text over glass
- [ ] Android back, safe areas, status bar and keyboard behave
- [ ] No money or probability is animated or reformatted in the UI
- [ ] Observations recorded in `docs/perf.md`