/**
 * The credit glyph: a stack of three coins, drawn as outlines.
 *
 * This repository draws its own ink when the host has nothing to lend, and the
 * host's 188 icons contain no coin, credit, wallet or currency shape at all
 * (checked against the installed `dsh-client-ui-primitives`) — so this is
 * artwork of ours, exactly as the reasoning-level bulb is.
 *
 * **It is one object in two places.** The composer readout
 * (`credit-balance.tsx`) and the card's Credits tab show the same balance, two
 * clicks apart; giving them the same glyph is what makes a reader recognise the
 * number in both. The tab adds the word "Total" because it has the room and the
 * composer does not — the glyph is the shared part, not the sentence.
 *
 * **Stroked, not filled.** A filled stack was drawn first and rejected on sight:
 * the bulb reads as a thin outline even though it is one filled path, so a solid
 * glyph beside it looked like a different icon set. The line width is the host's
 * own `1` on this grid, which is what makes the two read as peers.
 *
 * **Flatter than a cylinder.** The construction is the host's `database` idiom —
 * a full top ellipse, straight walls, and a *front-half* arc per level below —
 * so the ellipse's minor axis is what separates "a stack of coins" from "a
 * database". At `ry = 1.25` it reads as coins; at `1.6` it reads as the database
 * glyph with extra lines (both were rendered at 64px to check).
 *
 * Drawn on the host's own 16-unit grid with `viewBox="0 0 16 16"`, at 16px,
 * because in the composer row it sits beside the reasoning-level bulb and the
 * two are read together: a glyph at a different size would make the row look
 * assembled from two sources. `currentColor` throughout, so both themes come
 * from the surrounding colour token — no literal colour, no `[data-ds-dark-theme]`
 * branch.
 *
 * @module dsh-workbuddy-bridge/client/coin-glyph
 */

import type { ReactNode } from 'react'
import css from './coin-glyph.module.css'

/** Render the coin-stack glyph. Decorative: the caller supplies the accessible name. */
export function CoinGlyph(): ReactNode {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      aria-hidden="true"
      className={css.glyph}
    >
      {/* The top coin's face. */}
      <ellipse cx="8" cy="4.7" rx="4.7" ry="1.25" />
      {/* Left wall, the floor's front half, right wall — one open path, so the
          hidden back half of the bottom coin is never drawn and the stack does
          not close into a cylinder. */}
      <path d="M3.3 4.7V10.7A4.7 1.25 0 0 0 12.7 10.7V4.7" />
      {/* The front edge of the middle coin, the line that makes it a stack. */}
      <path d="M3.3 7.7A4.7 1.25 0 0 0 12.7 7.7" />
    </svg>
  )
}
