import { describe, expect, it } from "vitest";
import { overlayKeyCode, overlayKeyFrom } from "./overlayKey";

describe("overlay key", () => {
  it("is Home when nothing or something unknown is saved", () => {
    expect(overlayKeyFrom(undefined)).toBe("Home");
    expect(overlayKeyFrom("Ctrl+Q")).toBe("Home");
  });

  it("keeps a saved key, including none", () => {
    expect(overlayKeyFrom("F8")).toBe("F8");
    expect(overlayKeyFrom("off")).toBe("off");
  });

  it("maps keys to Windows virtual-key codes", () => {
    expect(overlayKeyCode("Home")).toBe(0x24);
    expect(overlayKeyCode("F1")).toBe(0x70);
    expect(overlayKeyCode("F12")).toBe(0x7b);
    expect(overlayKeyCode("ScrollLock")).toBe(0x91);
    expect(overlayKeyCode("off")).toBe(0);
  });
});
