/** Identity pins belong to the reviewed verifier, never the evidence contract. */
export const HOSTED_REPOSITORY = "lapeninns/nabaperks"
export const HOSTED_WORKFLOW = ".github/workflows/ci.yml"
export const HOSTED_MAIN_BRANCH = "main"

export function requireHostedIdentity(provider, profile, headSha) {
  if (
    provider?.repository !== HOSTED_REPOSITORY ||
    provider.headRepository !== HOSTED_REPOSITORY ||
    provider.workflow !== HOSTED_WORKFLOW ||
    provider.headSha !== headSha
  ) {
    throw new Error(
      "Hosted evidence does not match the pinned repository, workflow and head SHA"
    )
  }
  const expectedEvent = profile === "pr" ? "pull_request" : "push"
  if (
    !["pr", "main"].includes(profile) ||
    provider.event !== expectedEvent ||
    (profile === "main" && provider.headBranch !== HOSTED_MAIN_BRANCH)
  ) {
    throw new Error(
      `Hosted event and branch do not match the ${profile} profile`
    )
  }
}
