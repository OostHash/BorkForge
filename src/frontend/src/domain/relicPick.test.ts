import { describe, expect, it } from "vitest";
import { pickCloseKeyCode, pickCloseKeyFrom } from "./relicPick";

describe("relic pick close key", () => {
  it("is Home when nothing or something unknown is saved", () => {
    expect(pickCloseKeyFrom(undefined)).toBe("Home");
    expect(pickCloseKeyFrom("Ctrl+Q")).toBe("Home");
  });

  it("keeps a saved key, including none", () => {
    expect(pickCloseKeyFrom("F8")).toBe("F8");
    expect(pickCloseKeyFrom("off")).toBe("off");
  });

  it("maps keys to Windows virtual-key codes", () => {
    expect(pickCloseKeyCode("Home")).toBe(0x24);
    expect(pickCloseKeyCode("F1")).toBe(0x70);
    expect(pickCloseKeyCode("F12")).toBe(0x7b);
    expect(pickCloseKeyCode("ScrollLock")).toBe(0x91);
    expect(pickCloseKeyCode("off")).toBe(0);
  });
});
