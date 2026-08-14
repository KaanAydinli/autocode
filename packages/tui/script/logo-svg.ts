#!/usr/bin/env bun
// Generates README logo SVGs from src/logo.ts so the banner always matches the TUI.
//
//   bun script/logo-svg.ts
//
// writes assets/logo-dark.svg and assets/logo-light.svg at the repo root.
import path from "path"
import { logo } from "../src/logo"

const CELL = 10 // half-block pixel size; a character cell is CELL wide, 2*CELL tall
const PAD = 20

type Palette = { left: string; right: string; leftShadow: string; rightShadow: string }
const themes: Record<string, Palette> = {
  dark: { left: "#8a8a8a", right: "#ffffff", leftShadow: "#333333", rightShadow: "#3d3d3d" },
  light: { left: "#767676", right: "#111111", leftShadow: "#d9d9d9", rightShadow: "#cccccc" },
}

function cells(line: string, row: number, xOffset: number, fg: string, shadow: string) {
  const rects: string[] = []
  const push = (column: number, half: "top" | "bottom" | "full", color: string) => {
    const x = PAD + (xOffset + column) * CELL
    const y = PAD + row * 2 * CELL + (half === "bottom" ? CELL : 0)
    const height = half === "full" ? 2 * CELL : CELL
    rects.push(`<rect x="${x}" y="${y}" width="${CELL}" height="${height}" fill="${color}"/>`)
  }
  Array.from(line).forEach((char, column) => {
    if (char === "█") push(column, "full", fg)
    if (char === "▀") push(column, "top", fg)
    if (char === "▄") push(column, "bottom", fg)
    if (char === "^") {
      push(column, "top", fg)
      push(column, "bottom", shadow)
    }
    if (char === "_") push(column, "full", shadow)
    if (char === "~") push(column, "top", shadow)
    if (char === ",") push(column, "bottom", shadow)
  })
  return rects
}

function render(palette: Palette) {
  const leftWidth = Math.max(...logo.left.map((line) => line.length))
  const rows = logo.left.length
  const rightWidth = Math.max(...logo.right.map((line) => line.length))
  const width = PAD * 2 + (leftWidth + 1 + rightWidth) * CELL
  const height = PAD * 2 + rows * 2 * CELL
  const rects = [
    ...logo.left.flatMap((line, row) => cells(line, row, 0, palette.left, palette.leftShadow)),
    ...logo.right.flatMap((line, row) => cells(line, row, leftWidth + 1, palette.right, palette.rightShadow)),
  ]
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="autocode">
${rects.join("\n")}
</svg>
`
}

const out = path.join(import.meta.dir, "..", "..", "..", "assets")
for (const [name, palette] of Object.entries(themes)) {
  const file = path.join(out, `logo-${name}.svg`)
  await Bun.write(file, render(palette))
  console.log("wrote", file)
}
