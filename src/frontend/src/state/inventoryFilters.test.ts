import { afterEach, expect, it } from "vitest";
import { DEFAULT_INVENTORY_FILTERS } from "../domain/inventory";
import { getInventoryFilters, resetInventoryFilters, setInventoryFilters, showItem, showRecent } from "./inventoryFilters";

afterEach(() => {
  resetInventoryFilters();
});

it("showItem searches for the name and keeps the other filters", () => {
  setInventoryFilters({ ...DEFAULT_INVENTORY_FILTERS, filterPrime: true });
  showItem("Ferrite");
  expect(getInventoryFilters()).toMatchObject({ search: "Ferrite", filterPrime: true });
});

it("showRecent resets to Changed recently in a category, keeping the sort", () => {
  setInventoryFilters({ ...DEFAULT_INVENTORY_FILTERS, filterPrime: true, search: "x", sortMode: "name-asc" });
  showRecent("Mods");
  expect(getInventoryFilters()).toEqual({ ...DEFAULT_INVENTORY_FILTERS, filterRecent: true, category: "Mods", sortMode: "name-asc" });
  showRecent();
  expect(getInventoryFilters().category).toBe("all");
});
