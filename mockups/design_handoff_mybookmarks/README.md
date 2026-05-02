# Handoff: MyBookmarks Dashboard

## Overview
A personal bookmark dashboard ("MyBookmarks") that organises a user's saved links into **categories** (one per bookmark) and **tags** (multi). Bookmarks live in Notion; the front-end pulls them on demand and renders a fast, searchable browsing UI with grouped "mega cards" for thematic clusters of related sites (e.g. *Game Stores* → Steam, Epic, GOG…).

## About the Design Files
The files in this bundle are **design references created in HTML/JSX** — interactive prototypes showing intended look and behavior. They are NOT production code. The task is to **recreate these designs in your existing codebase** using its established patterns, framework (React/Vue/Svelte/etc.), styling system, and component library. If no codebase environment exists yet, choose the most appropriate framework and implement there.

The reference is a single Babel-transpiled HTML page with inline JSX, organised into:
- `data.jsx` — sample data shape (mirror this in your Notion schema)
- `cards.jsx` — `BookmarkCard`, `MegaCard`, `MiniCard` components
- `app.jsx` — main shell, search/filter logic, sidebar, scroll-spy
- `styles.css` — all styling (CSS variables for theming)
- `tweaks-panel.jsx` — design-time tweaks panel (NOT for production; ignore in implementation)

## Fidelity
**High-fidelity.** Pixel values, colors, OKLCH hues, transitions, hover states, and behavior should be matched closely. Use your codebase's design tokens where they map cleanly; otherwise port the values from `styles.css`.

---

## Data Model (mirror in Notion)

```ts
type Category = {
  id: string;       // 'iot' | 'media' | …
  name: string;     // 'IoT'
  hue: number;      // 0–360, drives accent color via OKLCH
};

type Bookmark = {
  id: string;
  title: string;
  subtitle?: string;          // shown under title; usually domain
  url?: string;               // omitted for parents of mega cards
  category: string;           // exactly one
  tags: string[];             // many
  color?: number;             // OKLCH hue 0–360. OPTIONAL —
                              //   ~40% of bookmarks should have NO color
                              //   (renders neutral, no accent stripe).
  logo: string;               // 1–4 chars / symbol shown in thumb fallback
  logoStyle?: 'mono';         // optional: render thumb monochrome (e.g. ASUS, Vercel)
  rating?: number;            // 0–5 stars
  favorite?: boolean;         // shows star in top-left corner

  // Mega card grouping — done in Notion via parent relation
  isParent?: boolean;         // parent has NO url; only groups children
  group?: string;             // child references parent's id

  // Special feature: search inside the destination site
  search?: {
    placeholder: string;
    urlTemplate: string;      // 'https://example.com/search?q={q}'
  };
};
```

### Mega cards
- A bookmark with `isParent: true` and no `url` acts as a header for a thematic group.
- Children reference it via `group: <parentId>`.
- The parent and any child can have a `search` field that opens a search on that site in a new tab.
- Examples in sample data: **Game Stores** (Steam, Epic, GOG, itch, Humble) and **Dev Docs** (MDN, React, Can I Use, DevDocs.io).

---

## Layout Overview

```
┌──────────────┬────────────────────────────────────────────────┐
│              │  [search input ………………]  [Tags]  [⟳]  Synced…  │
│   sidebar    ├────────────────────────────────────────────────┤
│   240 px     │  (optional) tags-panel — collapsible           │
│              ├────────────────────────────────────────────────┤
│   • Brand    │  Category section header                       │
│              │  Cards grid (auto-fill, minmax(220px, 1fr))    │
│   Categories │                                                │
│   • IoT      │  Category section header                       │
│   • Media    │  Cards grid                                    │
│   • …        │                                                │
│              │  …                                             │
│   [light/dk] │                                                │
└──────────────┴────────────────────────────────────────────────┘
```

- App grid: `grid-template-columns: 240px 1fr;`
- Sidebar is sticky (`position: sticky; top: 0; height: 100vh; overflow-y: auto;`)
- Topbar is sticky inside main column with a fade-bg

---

## Screens / States

### 1. Browsing (default — no query, no tags)
- Sidebar lists categories with a colored dot per category (uses `oklch(0.55 0.15 <hue>)`) and item count. Active category highlights as user scrolls (IntersectionObserver scroll-spy).
- Main shows each category as a section: dot + name + count + horizontal rule, followed by the cards grid.
- **Mega cards span 2 columns** in the grid (`grid-column: span 2`). On narrow viewports they collapse to 1.

### 2. Filtering (query OR tags selected)
- Categories disappear; cards render as a single flat grid.
- A "result strip" above the grid shows: `<N> results for "<query>"` and `filtered by <tag1> + <tag2>`, with a `Clear all` chip.
- Mega cards still appear: parent + children when parent matches; or parent + only matching children when only some children match.
- Empty state: "No matches" + hint.

### 3. Tags panel (collapsible)
- Toggled by the `Tags` button in the topbar (button shows badge with count when tags are selected).
- Tags are shown **alphabetically**.
- **Each tag has 5 importance levels** based on count relative to the max count in the *current visible universe* (counts update as you search):
  - lvl-1: 22px, 10.5px font, 400 weight, 0.62 opacity
  - lvl-2: 24px, 11.5px font, 400 weight, 0.78 opacity
  - lvl-3: 26px, 12.5px font, 500 weight
  - lvl-4: 28px, 13.5px font, 500 weight
  - lvl-5: 30px, 14.5px font, 600 weight, stronger border & soft bg
  - Quantile breakpoints on `count/max`: `>0.8 → 5`, `>0.55 → 4`, `>0.30 → 3`, `>0.12 → 2`, else `1`.
- Counts: when N tags are selected, the displayed count for any tag T = number of bookmarks whose tags include `selectedTags + T` (i.e. *intersection*, not union). Tags that would zero out get `.disabled` (opacity 0.28).

---

## Components

### BookmarkCard (regular card)
- Container: `background: var(--bg-elev)`, `border: 0.5px solid var(--border)`, `border-radius: 14px`, `padding: 12px 12px 12px 16px`, min-height 78px.
- Layout: flex row, `gap: 12px`, items aligned to top.
- **Color accent**: 4px-wide vertical stripe on the left edge using `oklch(0.65 0.16 <hue>)` (light) / `oklch(0.70 0.16 <hue>)` (dark). Stripe widens to 5px on hover. Plus a subtle bottom-edge gradient glow on hover.
- **No-color cards** (~40% of bookmarks): no stripe, no glow, neutral on hover (border-strong only). Padding stays at 12px on the left.
- Thumb: 52×52, 10px radius, neutral `var(--bg-soft)` background, 0.5px border, holds the `logo` text. **Image is NEVER tinted with the accent color** — colors live on the card body, not the image, because most images won't be transparent.
- Body: title (13.5px / 600), subtitle (11.5px / faint, ellipsis), rating row (5 small stars), tags row (max 3 tag chips, hidden in compact density).
- Edit pencil button: top-right, 24×24, opacity 0 by default, opacity 1 on hover.
- Favorite star: top-left, only when `favorite: true`, gold (`oklch(0.75 0.13 75)`).
- Search input row: appears at the bottom of the card body when `search` is defined, 24px tall, opens `urlTemplate.replace('{q}', encodeURIComponent(query))` in a new tab. Stops event propagation so clicking the input doesn't navigate.

### MegaCard (parent + children)
- Container: same base as card but `border-radius: 18px`, `padding: 14px`, `flex-direction: column`, `gap: 12px`. Spans 2 grid columns.
- **Color accent**: 3px horizontal band along the top edge, plus a radial gradient glow originating from the top-left corner.
- Header row: parent thumb (44×44, neutral) + title block + a small `<N> sites` badge tinted with the accent + edit pencil (hover-only).
- Optional search row: 30px input + dark `Search` button. Same behavior as card search.
- Children grid: `grid-template-columns: repeat(auto-fill, minmax(150px, 1fr))`, separated by a `0.5px solid var(--border)` top border.

### MiniCard (child of mega card)
- Compact horizontal item: 28×28 neutral thumb + title (12px) + sub (10.5px, faint) + edit pencil (hover).
- **Color accent**: thin 3px vertical stripe on the left, animated to extend on hover. Hidden for no-color children.
- If `search` is defined: switches to a vertical layout (stacked title row + mini search input + button).

### Sidebar category link
- 7×10 padding, 13px text, hover bg `var(--bg-soft)`.
- Active state: bg `var(--bg-soft)` + 2px-wide colored vertical bar on the left edge using the category's hue.
- Each item: colored dot (8×8, hue-based) + name + right-aligned count.

### Topbar
- Search input: 42px tall, `border-radius: 11px`, magnifier icon at left, `⌘K` kbd hint at right.
- "Tags" button: 42px, gains `.active` class + badge with selected count when filtering.
- Refresh button: 42×42 icon button. On click, briefly spin the icon (rotate 360°) and update "Synced just now". This is where the Notion fetch goes.
- Sticky with a `linear-gradient(to bottom, var(--bg) 80%, transparent)` background to fade content behind it.

---

## Behavior

### Search
- Input filters the universe by checking if the lowercased concatenation of `title + subtitle + url + tags` includes the lowercased query.
- For mega cards, parent is shown if parent OR any child matches.

### Tag filter (AND semantics)
- A bookmark matches the tag filter when it contains *every* selected tag.
- Counts shown next to each tag are *recomputed* against the current search universe AND existing tag selection (intersection logic).

### Refresh
- Triggers a fetch from Notion. Show the spin animation while loading; update "Synced X" timestamp on completion. Errors should toast and not break the view.

### Edit
- Edit buttons are placeholders in the design. Wire to whatever editing flow exists (open Notion page, modal form, etc.).

### Card click
- Clicking the card body navigates to `bm.url` (target `_blank`, `rel="noopener noreferrer"`).
- Clicking the search input/button inside the card MUST stop propagation and use `preventDefault` so it doesn't trigger card nav.

### Theme
- `data-theme="light"` (default) or `data-theme="dark"` on `<html>`. All colors are CSS variables, swapped per theme.
- Density: `data-density="compact" | "regular" | "comfy"` on `<html>` adjusts grid `minmax`, card padding, thumb size, and tag visibility.

---

## Design Tokens

### Colors (light)
| Token | Value |
|---|---|
| `--bg` | `#faf9f7` |
| `--bg-elev` | `#ffffff` |
| `--bg-soft` | `#f3f1ec` |
| `--bg-softer` | `#ecebe5` |
| `--fg` | `#1c1a14` |
| `--fg-mid` | `#4a463c` |
| `--fg-soft` | `#7a7468` |
| `--fg-faint` | `#a8a294` |
| `--border` | `rgba(28, 26, 20, 0.08)` |
| `--border-strong` | `rgba(28, 26, 20, 0.16)` |

### Colors (dark)
| Token | Value |
|---|---|
| `--bg` | `#14130f` |
| `--bg-elev` | `#1d1c17` |
| `--bg-soft` | `#25241e` |
| `--bg-softer` | `#2e2c25` |
| `--fg` | `#ece9e0` |
| `--fg-mid` | `#c2bdaf` |
| `--fg-soft` | `#918a78` |
| `--fg-faint` | `#5e584b` |
| `--border` | `rgba(255, 248, 230, 0.08)` |
| `--border-strong` | `rgba(255, 248, 230, 0.16)` |

### Per-bookmark accent (when `color` defined)
- Accent color: `oklch(0.65 0.16 <hue>)` (light), `oklch(0.70 0.16 <hue>)` (dark)
- Subtle tints: `oklch(0.92 0.06 <hue> / α)` (light), `oklch(0.45 0.10 <hue> / α)` (dark)

### Per-category accent
- Dot/border color: `oklch(0.55 0.15 <hue>)`
- Tint background: `oklch(0.92 0.07 <hue>)`

### Typography
- Font: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. Feature settings `"ss01", "cv11"`.
- Sizes used: 10px, 10.5px, 11px, 11.5px, 12px, 12.5px, 13px, 13.5px, 14px, 15px.

### Radii
- 5px, 6px, 7px, 8px, 9px, 10px, 11px, 14px (`--radius`), 18px (`--radius-lg`).

### Shadows
- `--shadow-sm`: `0 1px 2px rgba(28,26,20,.04), 0 0 0 0.5px rgba(28,26,20,.06)`
- `--shadow-md`: `0 1px 3px rgba(28,26,20,.06), 0 8px 24px rgba(28,26,20,.05)`
- `--shadow-lg`: `0 2px 8px rgba(28,26,20,.08), 0 16px 48px rgba(28,26,20,.10)`
  (Dark variants in `styles.css`.)

### Transitions
- Hover transforms / color shifts: 120–200ms ease.
- Card lift on hover: `transform: translateY(-1px)` + `box-shadow: var(--shadow-md)`.

---

## State Management

```
state {
  query: string
  selectedTags: string[]
  tagsOpen: boolean
  activeCat: string | null     // updated by IntersectionObserver
  refreshing: boolean
  lastSync: string             // 'just now' | '8 minutes ago' | …
  bookmarks: Bookmark[]        // from Notion
  categories: Category[]       // from Notion
  theme: 'light' | 'dark'      // persisted
  density: 'compact' | 'regular' | 'comfy'  // persisted
}
```

Derived:
- `parents`, `childrenByParent`, `freeBookmarks` — built once from raw bookmarks.
- `tagCounts` — recomputed on `(query, selectedTags)` change with intersection logic.
- `allTags` — sorted alphabetically.
- `filteredFlat` (when filtering) or `grouped` (when browsing).

---

## Assets
- No external assets required. All "logos" are short text/symbols placed in a neutral thumb. Replace with `<img>` (favicon URL) in production — when an image exists it should render inside the same neutral 52×52 thumb container. The accent color stays on the card stripe, not the image.
- Icons in design are inline SVGs (search, edit, refresh, tag, star, arrow, moon). Use your icon library (Lucide, Heroicons, etc.).

---

## Files in this bundle
- `MyBookmarks.html` — entry point; loads React + Babel + the JSX modules.
- `app.jsx` — top-level `App`, layout, search/filter/scroll-spy logic.
- `cards.jsx` — `BookmarkCard`, `MegaCard`, `MiniCard`, `Thumb`, `Icon`.
- `data.jsx` — sample `CATEGORIES` and `BOOKMARKS` arrays.
- `styles.css` — all styling, theme variables, density modifiers.
- `tweaks-panel.jsx` — design-time tweaks panel; **ignore for production**.

To preview locally: open `MyBookmarks.html` in a browser (uses CDN React/Babel).
