/**
 * CSS Modules typing for the browser bundle.
 *
 * The build turns `x.module.css` into a module exporting the compiled
 * stylesheet's hashed class map (see `tsdown.config.ts`); TypeScript only ever
 * sees the import specifier, so it needs this shape.
 */

declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>
  export default classes
}
