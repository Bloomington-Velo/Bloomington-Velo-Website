#!/usr/bin/env node
// Regenerates assets/img/og-default.jpg (1200x630), the card that represents
// the club in every shared link -- Facebook, Slack, iMessage, X.
//
// It is built on the club's own photograph of the group at the IU Sample
// Gates, under a navy scrim, with the BV logo on its light plate and the club
// name. Before 2026-08 this was a flat navy panel because no club photography
// existed; it does now, and a photo-backed card is a far better artefact than
// logo-on-flat-colour.
//
// SOURCE: assets/img/hero-2400.jpg, not the 4032x3024 original. The original
// lives in Photos.zip, which is gitignored and 519 MB, so a generator that
// depended on it would stop working for anyone who did not have the zip --
// exactly the failure mode this script exists to avoid. hero-2400.jpg is the
// same crop of the same frame, committed, and the difference between a card
// built from it and one built from the original measures 2.94/255 mean
// absolute channel difference (max 34) -- invisible once the result is a
// 1200x630 JPEG. Re-runnability is worth more than 1.2%.
//
// Usage: node tools/make-og-image.mjs
// Requires: npx --yes sharp-cli (rasterizes the composed SVG to JPEG).

import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const LOGO_PATH = join(ROOT, "assets", "img", "logo.png");
const PHOTO_PATH = join(ROOT, "assets", "img", "hero-2400.jpg");
const OUT_PATH = join(ROOT, "assets", "img", "og-default.jpg");

// Brand palette. These must stay in step with :root in assets/css/site.css.
// tests/chrome.test.mjs scans this file for retired colours, so a stale value
// here fails the suite instead of silently shipping the old brand as PIXELS --
// which is what happened when the palette changed in 2026-08 and this file kept
// the previous navy for a round. No text scan of the shipped files could find
// it, because the only place it surfaced was inside a JPEG. Do not write a
// retired colour value here even inside a comment: the scan is a plain string
// search, and it is right to be.
const NAVY = "#17233B";           // --navy, the seal navy
const ACCENT = "#E4291A";         // --accent, the banner red
const ON_NAVY_MUTED = "#D6E0EA";  // --on-navy-muted
const PLATE = "#F4F6FB";          // light plate behind the logo

const WIDTH = 1200;
const HEIGHT = 630;

// The photograph is placed by transform rather than pre-cropped, so the whole
// job stays a single SVG rasterization with no intermediate image step.
// hero-2400.jpg is 2400x1050 (16:7). The card is 1.905:1, so the window
// x=400..2400 of the hero is scaled by 1200/2000 = 0.6 and shifted left.
// That window keeps the whole rider group, the complete Sample Gates arch and
// the clock tower, and leaves the lower left quiet enough to carry type.
const PHOTO_W = 2400;
const PHOTO_H = 1050;
const PHOTO_SCALE = 0.6;
const PHOTO_X = -400 * PHOTO_SCALE;

const logoBase64 = readFileSync(LOGO_PATH).toString("base64");
const photoBase64 = readFileSync(PHOTO_PATH).toString("base64");

// Logo plate, top left.
const logoSize = 160;
const plateR = logoSize / 2 + 15;
const plateCx = 56 + plateR;
const plateCy = 56 + plateR;

// The source logo.png is dark navy/near-black artwork on a transparent
// background, so it needs a light plate behind it to read against the card.
// Do NOT recolor the logo itself -- the same logo.png is reused verbatim in
// the site header, favicon, and manifest icons, and a recolored variant here
// would diverge from the canonical mark.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="scrimH" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${NAVY}" stop-opacity="0.95"/>
      <stop offset="42%" stop-color="${NAVY}" stop-opacity="0.80"/>
      <stop offset="100%" stop-color="${NAVY}" stop-opacity="0.46"/>
    </linearGradient>
    <linearGradient id="scrimV" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${NAVY}" stop-opacity="0.42"/>
      <stop offset="40%" stop-color="${NAVY}" stop-opacity="0.20"/>
      <stop offset="62%" stop-color="${NAVY}" stop-opacity="0.62"/>
      <stop offset="82%" stop-color="${NAVY}" stop-opacity="0.92"/>
      <stop offset="100%" stop-color="${NAVY}" stop-opacity="0.95"/>
    </linearGradient>
  </defs>

  <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="${NAVY}"/>
  <image x="${PHOTO_X}" y="0" width="${PHOTO_W * PHOTO_SCALE}" height="${PHOTO_H * PHOTO_SCALE}" href="data:image/jpeg;base64,${photoBase64}"/>
  <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="url(#scrimH)"/>
  <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="url(#scrimV)"/>

  <circle cx="${plateCx}" cy="${plateCy}" r="${plateR}" fill="${PLATE}"/>
  <image x="${plateCx - logoSize / 2}" y="${plateCy - logoSize / 2}" width="${logoSize}" height="${logoSize}" href="data:image/png;base64,${logoBase64}"/>

  <rect x="56" y="398" width="80" height="8" fill="${ACCENT}"/>
  <text x="56" y="500" font-family="Arial, Helvetica, sans-serif" font-size="104" font-weight="700" fill="#ffffff">Bloomington Velo</text>
  <text x="56" y="556" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="400" fill="${ON_NAVY_MUTED}">Cycling Club &#183; Bloomington, Indiana</text>
</svg>
`;

const workDir = mkdtempSync(join(tmpdir(), "bv-og-"));
const svgPath = join(workDir, "og-default.svg");
writeFileSync(svgPath, svg, "utf8");

// Quote a single argument for a Windows cmd.exe command line. Only used by
// the cmd.exe fallback path below; POSIX shells and the direct npx-cli.js
// invocation get the args array as-is via shell:false, which lets Node do
// correct Windows argv escaping itself.
function quoteArgForCmd(arg) {
  if (arg !== "" && !/[\s"]/.test(arg)) return arg;
  return `"${arg.replace(/"/g, '\\"')}"`;
}

const npxArgs = [
  "--yes",
  "sharp-cli",
  "--input",
  svgPath,
  "--output",
  workDir,
  "--format",
  "jpeg",
  "--quality",
  "82",
  "resize",
  String(WIDTH),
  String(HEIGHT),
];

try {
  if (process.platform === "win32") {
    // npx on Windows resolves to npx.cmd, a batch file. Batch files can
    // only run through a shell, and npm's own npx.cmd wrapper has a known
    // bug forwarding %* arguments that contain spaces (verified: a temp
    // path with a space gets re-split by the time it reaches sharp-cli's
    // arg parser, even when we quote the cmd.exe command line ourselves).
    // So prefer invoking npx's underlying JS entry point directly with
    // `node`, which goes through Node's own (correct) Windows argv
    // escaping via execFileSync with shell:false -- no batch file, no
    // quoting bug. Fall back to the cmd.exe wrapper if that entry point
    // isn't where we expect it (e.g. a differently-laid-out install).
    const npxCliPath = join(dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js");
    if (existsSync(npxCliPath)) {
      execFileSync(process.execPath, [npxCliPath, ...npxArgs], {
        stdio: "inherit",
        shell: false,
      });
    } else {
      const commandLine = ["npx", ...npxArgs].map(quoteArgForCmd).join(" ");
      execFileSync("cmd.exe", ["/d", "/s", "/c", commandLine], {
        stdio: "inherit",
        shell: false,
      });
    }
  } else {
    execFileSync("npx", npxArgs, { stdio: "inherit", shell: false });
  }
  const producedPath = join(workDir, "og-default.jpg");
  const jpegBuffer = readFileSync(producedPath);
  writeFileSync(OUT_PATH, jpegBuffer);
  console.log(`Wrote ${OUT_PATH} (${jpegBuffer.length} bytes)`);
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
