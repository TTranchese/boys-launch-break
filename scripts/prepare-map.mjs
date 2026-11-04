/** Serve MapLibre's bundled worker from our origin (including Turbopack dev). */
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const output = new URL("../public/maplibre/", import.meta.url);
mkdirSync(output, { recursive: true });
copyFileSync(
  require.resolve("maplibre-gl/dist/maplibre-gl-worker.mjs"),
  new URL("worker.mjs", output),
);
copyFileSync(join(dirname(require.resolve("maplibre-gl/package.json")), "LICENSE.txt"), new URL("LICENSE.txt", output));
console.log("Prepared self-hosted MapLibre worker.");
