import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { clearMocks } from "@tauri-apps/api/mocks";
import { afterEach, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";
import { installMocks } from "../dev/installMocks";
import { useWorldState } from "./worldstate";

afterEach(() => {
  clearMocks();
});

it("loads worldstate through the typed invoke wrapper", async () => {
  installMocks("");
  const client = new QueryClient();
  const { result } = await renderHook(() => useWorldState(), {
    wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
  await expect.poll(() => result.current.data?.fissures?.length).toBeGreaterThan(0);
});
