// Dev-only entry, loaded by mock.html. Never a build input.
import { installMocks, startMockInventoryEvents } from "./installMocks";

installMocks();
if (new URLSearchParams(window.location.search).get("scenario") === null) startMockInventoryEvents();

await import("../main");
