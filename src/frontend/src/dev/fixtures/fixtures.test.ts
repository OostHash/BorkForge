import { afterEach, describe, expect, it } from "vitest";
import { clearMocks } from "@tauri-apps/api/mocks";
import { invoke } from "../../api/invoke";
import { installMocks } from "../installMocks";
import { readScenario } from "./scenario";

describe("mock IPC", () => {
  afterEach(() => {
    clearMocks();
  });

  it("answers commands with the default fixture", async () => {
    installMocks("");
    const ws = await invoke("fetch_worldstate");
    expect(ws.fissures?.length).toBeGreaterThan(0);
  });

  it("serves the empty fixture", async () => {
    installMocks("?scenario=empty");
    await expect(invoke("fetch_worldstate")).resolves.toEqual({});
  });

  it("rejects in the error scenario", async () => {
    installMocks("?scenario=error");
    await expect(invoke("fetch_worldstate")).rejects.toThrow(/scenario=error/);
  });

  it("falls back to default for unknown scenarios", () => {
    expect(readScenario("?scenario=bogus")).toBe("default");
  });
});
