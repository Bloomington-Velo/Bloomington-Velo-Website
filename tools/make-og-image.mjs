#!/usr/bin/env node
// Regenerates assets/img/og-default.jpg (1200x630) from the BV logo and brand
// colors. There is no club photograph available yet (open item in the spec);
// once one is supplied, swap the <rect> background for an <image> with a
// navy scrim overlay and re-run this script.
//
// Usage: node tools/make-og-image.mjs
// Requires: npx --yes sharp-cli (rasterizes the composed SVG to JPEG).

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const LOGO_PATH = join(ROOT, "assets", "img", "logo.png");
const OUT_PATH = join(ROOT, "assets", "img", "og-default.jpg");

const NAVY = "#132856";
const WIDTH = 1200;
const HEIGHT = 630;

const logoBase64 = readFileSync(LOGO_PATH).toString("base64");
const logoSize = 170;
const logoX = (WIDTH - logoSize) / 2;
const logoY = 70;
const centerX = WIDTH / 2;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="${NAVY}"/>
  <image x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}" href="data:image/png;base64,${logoBase64}"/>
  <text x="${centerX}" y="400" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="100" font-weight="700" fill="#ffffff">Bloomington Velo</text>
  <text x="${centerX}" y="455" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="400" fill="#e7ecf5">Cycling Club &#183; Bloomington, Indiana</text>
</svg>
`;

const workDir = mkdtempSync(join(tmpdir(), "bv-og-"));
const svgPath = join(workDir, "og-default.svg");
writeFileSync(svgPath, svg, "utf8");

try {
  execFileSync(
    "npx",
    [
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
    ],
    { stdio: "inherit", shell: true }
  );
  const producedPath = join(workDir, "og-default.jpg");
  const jpegBuffer = readFileSync(producedPath);
  writeFileSync(OUT_PATH, jpegBuffer);
  console.log(`Wrote ${OUT_PATH} (${jpegBuffer.length} bytes)`);
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
