import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "fs";
import { join, basename } from "path";

const ICONS_DIR = join(import.meta.dirname, "..", "src", "assets", "icons");
const OUTPUT = join(import.meta.dirname, "..", "public", "icons", "sprite.svg");
const PRESERVED_SVG_ATTRIBUTES = [
  "fill",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-dasharray",
  "stroke-dashoffset",
  "fill-rule",
  "clip-rule",
];

const files = readdirSync(ICONS_DIR)
  .filter((f) => f.endsWith(".svg"))
  .sort((a, b) => a.localeCompare(b));

const symbols = [];

function escapeAttribute(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getOuterSvgAttributes(svg) {
  const openTagMatch = svg.match(/<svg\b([^>]*)>/);
  const openTag = openTagMatch?.[1] ?? "";

  return PRESERVED_SVG_ATTRIBUTES.flatMap((attribute) => {
    const escapedName = attribute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = openTag.match(new RegExp(`\\s${escapedName}="([^"]*)"`));
    return match ? [`${attribute}="${escapeAttribute(match[1])}"`] : [];
  });
}

for (const file of files) {
  const name = basename(file, ".svg");
  let svg = readFileSync(join(ICONS_DIR, file), "utf-8");

  // Remove XML declaration and DOCTYPE
  svg = svg.replace(/<\?xml[^?]*\?>\s*/g, "");
  svg = svg.replace(/<!DOCTYPE[^>]*>\s*/g, "");

  // Extract inner content between <svg> tags
  const content = svg.replace(/<svg[^>]*>/, "").replace(/<\/svg>/, "").trim();

  // Extract viewBox from outer <svg>
  const viewBoxMatch = svg.match(/viewBox="([^"]+)"/);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : "0 0 24 24";
  const attributes = getOuterSvgAttributes(svg);

  symbols.push(
    `  <symbol id="${name}" viewBox="${escapeAttribute(viewBox)}"${attributes.length ? ` ${attributes.join(" ")}` : ""}>${content}</symbol>`
  );
}

const sprite = `<svg xmlns="http://www.w3.org/2000/svg">\n${symbols.join("\n")}\n</svg>`;

mkdirSync(join(import.meta.dirname, "..", "public", "icons"), { recursive: true });
writeFileSync(OUTPUT, sprite, "utf-8");

console.log(`Sprite generated: ${symbols.length} icons → ${OUTPUT}`);
