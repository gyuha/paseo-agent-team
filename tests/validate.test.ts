import { describe, expect, it } from "vitest";
import type { Team } from "../shared/team";
import { catalogFrom, validateTeam, type ProviderEntry } from "../shared/validate";

const entries: ProviderEntry[] = [
  { provider: "claude", enabled: true, status: "ready", models: [{ id: "claude-opus-5-5", label: "Opus 5.5" }] },
  { provider: "codex", enabled: true, status: "ready", models: [{ id: "gpt-6.1-sol", label: "GPT-6.1-Sol" }, { id: "hidden", label: "Hidden", isSelectable: false }] },
  { provider: "antigravity", enabled: true, status: "ready", models: [{ id: "gemini-4-argon-high", label: "Gemini 4 Argon (High)" }] },
  { provider: "copilot", enabled: true, status: "unavailable", models: [{ id: "gpt-x", label: "x" }] },
  { provider: "omp", enabled: false, status: "ready", models: [{ id: "m", label: "m" }] },
];

const team: Team = {
  version: 1,
  goal: "",
  orchestrator: { workspace: "orchestrator", provider: "claude", model: "claude-opus-5-5" },
  roles: [
    { name: "design", workspace: "design", provider: "codex", model: "gpt-6.1-sol", folders: [], instructions: "" },
    { name: "sound", workspace: "sound", provider: "antigravity", model: "gemini-4-argon-high", folders: [], instructions: "" },
  ],
};

describe("catalogFrom", () => {
  it("keeps enabled providers, marks readiness and drops unselectable models", () => {
    const catalog = catalogFrom(entries);
    expect(catalog.map((provider) => provider.id)).toEqual(["claude", "codex", "antigravity", "copilot"]);
    expect(catalog.find((provider) => provider.id === "codex")?.models.map((model) => model.id)).toEqual(["gpt-6.1-sol"]);
    expect(catalog.find((provider) => provider.id === "copilot")?.ready).toBe(false);
  });
});

describe("validateTeam", () => {
  const catalog = catalogFrom(entries);

  it("returns no errors when every provider and model is available", () => {
    expect(validateTeam(team, catalog)).toEqual([]);
  });

  it("reports an unknown provider by role", () => {
    const errors = validateTeam({ ...team, roles: [{ ...team.roles[0], provider: "gemini" }] }, catalog);
    expect(errors).toEqual([{ target: "design", message: 'provider "gemini" is not enabled on this host' }]);
  });

  it("reports a disabled provider as not enabled", () => {
    const errors = validateTeam({ ...team, roles: [{ ...team.roles[0], provider: "omp", model: "m" }] }, catalog);
    expect(errors[0]?.message).toBe('provider "omp" is not enabled on this host');
  });

  it("reports a provider that is enabled but not ready", () => {
    const errors = validateTeam({ ...team, roles: [{ ...team.roles[0], provider: "copilot", model: "gpt-x" }] }, catalog);
    expect(errors).toEqual([{ target: "design", message: 'provider "copilot" is not ready (unavailable)' }]);
  });

  it("reports an unknown or unselectable model", () => {
    const errors = validateTeam({ ...team, roles: [{ ...team.roles[0], model: "hidden" }] }, catalog);
    expect(errors).toEqual([{ target: "design", message: 'model "hidden" is not available for codex' }]);
  });

  it("checks the orchestrator too", () => {
    const errors = validateTeam({ ...team, orchestrator: { ...team.orchestrator, model: "nope" } }, catalog);
    expect(errors).toEqual([{ target: "orchestrator", message: 'model "nope" is not available for claude' }]);
  });
});
