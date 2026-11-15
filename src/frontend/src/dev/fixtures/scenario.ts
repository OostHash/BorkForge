/**
 * Fixture scenarios, chosen with ?scenario=… on mock.html. Every command
 * fixture provides `default`; the other scenarios are derived here so loading,
 * empty and error states are reproducible without a backend.
 */
export const SCENARIOS = ["default", "empty", "loading", "error"] as const;
export type Scenario = (typeof SCENARIOS)[number];

export function readScenario(search: string = window.location.search): Scenario {
  const value = new URLSearchParams(search).get("scenario");
  return (SCENARIOS as readonly string[]).includes(value ?? "") ? (value as Scenario) : "default";
}

export type Fixture<T, A = undefined> = {
  default: (args: A) => T;
  empty?: (args: A) => T;
  /** Commands that write (e.g. save_settings) keep working in every scenario. */
  alwaysDefault?: boolean;
};

export function resolveFixture<T, A>(fixture: Fixture<T, A>, args: A, scenario: Scenario, command: string): Promise<T> {
  const effective = fixture.alwaysDefault ? "default" : scenario;
  switch (effective) {
    case "loading":
      return new Promise<T>(() => {});
    case "error":
      return Promise.reject(new Error(`mock: ${command} failed (scenario=error)`));
    case "empty":
      return Promise.resolve((fixture.empty ?? fixture.default)(args));
    case "default":
      return Promise.resolve(fixture.default(args));
  }
}
