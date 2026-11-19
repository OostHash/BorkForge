import { describe, expect, it } from "vitest";
import { pickKeyCode, pickKeyFrom } from "./relicPick";

describe("relic pick show/hide key", () => {
  it("is Home when nothing or something unknown is saved", () => {
    expect(pickKeyFrom(undefined)).toBe("Home");
    expect(pickKeyFrom("Ctrl+Q")).toBe("Home");
  });

  it("keeps a saved key, including none", () => {
    expect(pickKeyFrom("F8")).toBe("F8");
    expect(pickKeyFrom("off")).toBe("off");
  });

  it("maps keys to Windows virtual-key codes", () => {
    expect(pickKeyCode("Home")).toBe(0x24);
    expect(pickKeyCode("F1")).toBe(0x70);
    expect(pickKeyCode("F12")).toBe(0x7b);
    expect(pickKeyCode("ScrollLock")).toBe(0x91);
    expect(pickKeyCode("off")).toBe(0);
  });
});
