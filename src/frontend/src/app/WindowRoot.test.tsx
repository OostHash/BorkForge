import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { WindowRoot } from "./WindowRoot";

it("renders the window kind's own page", async () => {
  const screen = await render(
    <QueryClientProvider client={new QueryClient()}>
      <WindowRoot kind="riven-overlay" />
    </QueryClientProvider>,
  );
  await expect.element(screen.getByRole("main", { name: "Riven check" })).toBeVisible();
});
