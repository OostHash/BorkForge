// Generates src/theme/generated/*.css from src/theme/*.ts.
//   node scripts/build-tokens.ts           write the files
//   node scripts/build-tokens.ts --check   fail if a file is out of date
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { generatedFiles } from "../src/theme/build.ts";

const outDir = fileURLToPath(new URL("../src/theme/generated/", import.meta.url));
const check = process.argv.includes("--check");

await mkdir(outDir, { recursive: true });

const stale: string[] = [];
for (const [file, render] of Object.entries(generatedFiles)) {
  const path = outDir + file;
  const next = render();
  const current = await readFile(path, "utf8").catch(() => "");
  if (current === next) continue;
  if (check) stale.push(file);
  else await writeFile(path, next);
}

if (stale.length > 0) {
  console.error(`Generated tokens out of date: ${stale.join(", ")}. Run: pnpm tokens`);
  process.exit(1);
}
console.log(check ? "Tokens up to date." : "Tokens written.");
