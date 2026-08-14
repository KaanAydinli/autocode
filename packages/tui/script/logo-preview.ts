#!/usr/bin/env bun
// Live preview for src/logo.ts. Run from packages/tui:
//
//   bun --watch script/logo-preview.ts
//
// then edit src/logo.ts in your editor; every save re-renders here.
// Mark characters (see src/component/logo.tsx):
//   █ ▀ ▄  drawn as-is in the letter color
//   _      empty cell with the shadow background
//   ^      ▀ in the letter color on the shadow background
//   ~      ▀ drawn in the shadow color
//   ,      ▄ drawn in the shadow color
import { logo } from "../src/logo"

const RESET = "\x1b[0m"
const BOLD = "\x1b[1m"
const TEXT = "\x1b[38;5;255m"
const MUTED = "\x1b[38;5;246m"
const SHADOW_FG = "\x1b[38;5;238m"
const SHADOW_BG = "\x1b[48;5;236m"

function paint(line: string, fg: string, bold: boolean) {
  const style = fg + (bold ? BOLD : "")
  let out = ""
  for (const char of line) {
    if (char === "_") out += SHADOW_BG + " " + RESET
    else if (char === "^") out += style + SHADOW_BG + "▀" + RESET
    else if (char === "~") out += SHADOW_FG + "▀" + RESET
    else if (char === ",") out += SHADOW_FG + "▄" + RESET
    else out += style + char + RESET
  }
  return out
}

function ruler(width: number) {
  return Array.from({ length: width }, (_, index) => String(index % 10)).join("")
}

console.clear()
console.log(BOLD + "PREVIEW (how the TUI renders it)" + RESET)
console.log()
for (let index = 0; index < logo.left.length; index++) {
  console.log("  " + paint(logo.left[index], MUTED, false) + " " + paint(logo.right[index], TEXT, true))
}
console.log()
console.log(BOLD + "RAW STRINGS (edit these in src/logo.ts)" + RESET)
console.log()
const width = Math.max(...[...logo.left, ...logo.right].map((line) => line.length))
console.log("        " + SHADOW_FG + ruler(width) + "   " + ruler(width) + RESET)
for (let index = 0; index < logo.left.length; index++) {
  console.log(`  row ${index} ${SHADOW_FG}|${RESET}${logo.left[index]}${SHADOW_FG}|${RESET} ${SHADOW_FG}|${RESET}${logo.right[index]}${SHADOW_FG}|${RESET}`)
}
console.log()
console.log(`${SHADOW_FG}marks: _ shadow-space   ^ bar-on-shadow   ~ dim ▀   , dim ▄   (█ ▀ ▄ literal)${RESET}`)
console.log(`${SHADOW_FG}left = muted "auto", right = bold "code". Keep every row the same length per side.${RESET}`)
