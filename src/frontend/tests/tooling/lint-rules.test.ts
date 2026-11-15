import { beforeAll, describe, expect, it } from "vitest";
import { ESLint } from "eslint";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";

// Guards the guardrails: each rule from the plan (9.1) must actually fire.
// Also proves eslint-plugin-jsx-a11y works on ESLint 10 (see pnpm-workspace.yaml).
const cwd = fileURLToPath(new URL("../..", import.meta.url));
// The snippets below are virtual files; type-aware rules cannot see them, the
// rules under test do not need type information.
const eslint = new ESLint({
  cwd,
  overrideConfig: { ...tseslint.configs.disableTypeChecked, files: ["**/*.{ts,tsx}"] },
});

async function messages(code: string, filePath: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).map((m) => m.message);
}

describe("lint guardrails", () => {
  // The first lint loads the whole config (Tailwind design system included).
  // Next to the browser tests that can take longer than the 5 s test timeout,
  // so it happens once here, with room to spare.
  beforeAll(async () => {
    await messages("export const warmUp = 1;\n", "src/lib/warmUp.ts");
  }, 60_000);

  it("rejects Tailwind's default palette and dark: variants", async () => {
    const out = await messages(`export const A = () => <div className="bg-white/6 dark:bg-surface" />;\n`, "src/primitives/A.tsx");
    expect(out.join("\n")).toMatch(/Unknown class detected: bg-white\/6/);
    expect(out.join("\n")).toMatch(/Do not use dark: variants/);
  });

  it("rejects arbitrary sizes and colours", async () => {
    const out = await messages(`export const A = () => <div className="p-[7px] text-[#fff]" />;\n`, "src/primitives/A.tsx");
    expect(out.join("\n")).toMatch(/Do not use arbitrary sizes/);
    expect(out.join("\n")).toMatch(/Do not use arbitrary colors/);
  });

  it("enforces layer boundaries", async () => {
    const out = await messages(`import { installMocks } from "../dev/installMocks";\nexport const A = installMocks;\n`, "src/primitives/A.ts");
    expect(out.join("\n")).toMatch(/Layer primitives may not import dev/);
  });

  it("keeps Tauri inside api/ and app/", async () => {
    const out = await messages(`import { invoke } from "@tauri-apps/api/core";\nexport const A = invoke;\n`, "src/screens/timers/A.ts");
    expect(out.join("\n")).toMatch(/Use Tauri only through api\/ or app\//);
  });

  it("runs jsx-a11y", async () => {
    const out = await messages(`export const A = () => <img src="x.png" />;\n`, "src/primitives/A.tsx");
    expect(out.join("\n")).toMatch(/alt prop/);
  });
});
