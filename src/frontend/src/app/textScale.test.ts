import { afterEach, expect, it } from "vitest";
import { clearMocks, mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { applyTextScale } from "./textScale";

afterEach(() => {
  clearMocks();
});

it("sets the native webview zoom to the text scale", async () => {
  mockWindows("main");
  const calls: Array<{ cmd: string; payload: unknown }> = [];
  mockIPC((cmd, payload) => {
    calls.push({ cmd, payload });
  });
  await applyTextScale(1.5);
  expect(calls).toContainEqual({
    cmd: "plugin:webview|set_webview_zoom",
    payload: { label: "main", value: 1.5 },
  });
});

it("does nothing outside Tauri", async () => {
  // clearMocks() empties the Tauri internals object but leaves it on window.
  Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
  await expect(applyTextScale(1.25)).resolves.toBeUndefined();
});
