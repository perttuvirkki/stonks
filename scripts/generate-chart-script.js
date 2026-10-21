// Embeds the lightweight-charts standalone bundle into src/chartScript.ts so the chart WebView
// can load it offline. Run `npm run generate:chart` after bumping lightweight-charts.
const fs = require("fs");
const path = require("path");

const bundlePath = path.join(path.dirname(require.resolve("lightweight-charts/package.json")), "dist", "lightweight-charts.standalone.production.js");
const outPath = path.join(__dirname, "..", "src", "chartScript.ts");

const bundle = fs.readFileSync(bundlePath, "utf8");
fs.writeFileSync(outPath, `export const CHART_SCRIPT = ${JSON.stringify(bundle)};\n`);
console.log(`Wrote ${path.relative(process.cwd(), outPath)} (${bundle.length} chars)`);
