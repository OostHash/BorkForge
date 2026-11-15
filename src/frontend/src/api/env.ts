/** True inside a Tauri webview (real or mocked by @tauri-apps/api/mocks). */
export const isTauri = (): boolean => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
