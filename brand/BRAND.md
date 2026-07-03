# OSLS brand

Brand guidelines for **OSLS — Orbit Speaker Layout System**. An open standard from South Loop Studios. v1.0 · 2026.

> "Speaker layouts, declaratively."

## The mark

The OSLS mark is a **listening circle**: a ring with three nodes — one **Electric Blue** node (a height/active speaker) and two **Ink** nodes (floor speakers). It reads as a speaker layout viewed from above — the literal thing OSLS describes.

- **Primary lockup** (`brand/logo/png/osls-lockup.png`): mark + `OSLS` wordmark + `ORBIT SPEAKER LAYOUT SYSTEM`. Horizontal; use at **≥ 180 px wide**.
- **Reversed** (`osls-lockup-white.png`, `osls-icon-reversed.svg`): white-on-Ink for dark surfaces.
- **Mark only** (`osls-icon*.svg/png`): use the node mark alone below the wordmark's minimum.

## Clear space & minimum size

- **Clear space = 1×** the node diameter on all sides; keep all type and edges outside that field.
- **Minimum size:** 48 px (print) / 24 px (digital). **Below 24 px, drop the wordmark and use the node mark alone.**

## Colour

| Token | Hex | Role |
|---|---|---|
| **Ink** | `#16181D` | Primary / text |
| **Electric Blue** | `#2B62F0` | Accent / the height node |
| **Paper** | `#FFFFFF` | Surface |
| **Slate** | `#9AA0AB` | Secondary |
| **Cloud** | `#E6E8EC` | Hairline / fill |

## Typography

- **Space Grotesk** — display, wordmark, headings. Regular 400 · Medium 500 · SemiBold 600 · Bold 700.
- **IBM Plex Mono** — labels, code, metadata. Regular 400 · Medium 500 · SemiBold 600.

## Don't

- **Don't recolour** the whole mark (the blue node is the only accent).
- **Don't rotate** the mark.
- **Don't stretch or distort** the lockup or mark.

## Assets

`brand/logo/svg/` — `osls-icon.svg` (full colour), `osls-icon-black.svg`, `osls-icon-white.svg`, `osls-icon-reversed.svg`.
`brand/logo/png/` — `osls-icon-{64,128,256,512,1024}.png`, `osls-icon-{black,white,reversed}-1024.png`, `osls-lockup.png`, `osls-lockup-white.png`.

"OSLS", "Orbit Speaker Layout System", and the `.osls` extension are South Loop Studios marks. The format and SDK are open ([Apache-2.0](../LICENSE)); the name and mark are not — implement OSLS freely, but don't ship a fork *called* OSLS or use the mark to imply endorsement.
