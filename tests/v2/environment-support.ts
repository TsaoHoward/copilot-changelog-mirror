/** Keep host tooling, but require each operational test to select its own Actions context. */
export function fixtureEnvironment(
  overrides: NodeJS.ProcessEnv = {},
): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  for (const key of Object.keys(environment))
    if (
      key.startsWith("GITHUB_") ||
      key === "GH_TOKEN" ||
      key === "PAGES_STATUS" ||
      key === "STAGE_STATUS"
    )
      delete environment[key];
  return { ...environment, ...overrides };
}
