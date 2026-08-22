#!/usr/bin/env node
// Regenerates assets/img/og-default.jpg (1200x630) from the BV logo and brand
// colors. There is no club photograph available yet (open item in the spec);
// once one is supplied, swap the <rect> background for an <image> with a
// navy scrim overlay and re-run this script.
//
// Usage: node tools/make-og-image.mjs
// Requires: npx --yes sharp-cli (rasterizes the composed SVG to JPEG).

import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
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
const logoY = 120;
const centerX = WIDTH / 2;
const plateRadius = logoSize / 2 + 16;
const plateCy = logoY + logoSize / 2;

// The source logo.png is dark navy/near-black artwork on a transparent
// background, so it needs a light plate behind it to read against the navy
// card background. Do NOT recolor the logo itself -- the same logo.png is
// reused verbatim in the site header, favicon, and manifest icons, and a
// recolored variant here would diverge from the canonical mark.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="${NAVY}"/>
  <circle cx="${centerX}" cy="${plateCy}" r="${plateRadius}" fill="#f4f6fb"/>
  <image x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}" href="data:image/png;base64,${logoBase64}"/>
  <text x="${centerX}" y="440" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="100" font-weight="700" fill="#ffffff">Bloomington Velo</text>
  <text x="${centerX}" y="495" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="400" fill="#e7ecf5">Cycling Club &#183; Bloomington, Indiana</text>
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
