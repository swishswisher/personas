import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const luminance = (hex) => {
  const channels = hex
    .replace("#", "")
    .match(/../g)
    .map((c) => parseInt(c, 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};
const checks = [
  ["Body text", "#363044", "#FFFCFA", 4.5],
  ["Muted text", "#70677C", "#FFFCFA", 4.5],
  ["Primary button", "#FFFFFF", "#73549B", 4.5],
  ["Warning text", "#795019", "#FFF2DB", 4.5],
  ["Error text", "#A83135", "#FFF0ED", 4.5],
  ["Input boundaries", "#9B8FA7", "#FFFFFF", 3],
].map(([name, foreground, background, minimum]) => {
  const a = luminance(foreground),
    b = luminance(background),
    contrast = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  return {
    name,
    foreground,
    background,
    contrast: Number(contrast.toFixed(2)),
    minimum,
    passed: contrast >= minimum,
  };
});
const css = readFileSync("src/app/globals.css", "utf8");
const responsive = {
  breakpoints: [520, 800, 1100].every((n) =>
    new RegExp("max-width:\\s*" + n + "px").test(css),
  ),
  reducedMotion: css.includes("prefers-reduced-motion"),
  visibleFocus: css.includes(":focus-visible"),
  skipLink: css.includes(".skip-link"),
};
mkdirSync("docs/evidence", { recursive: true });
writeFileSync(
  "docs/evidence/design-static.json",
  JSON.stringify(
    {
      checks,
      responsive,
      limitation:
        "Token/CSS checks only. These do not establish rendered responsive behavior or WCAG compliance.",
    },
    null,
    2,
  ) + "\n",
);
console.log(checks);
if (checks.some((c) => !c.passed) || Object.values(responsive).some((v) => !v))
  process.exitCode = 1;
