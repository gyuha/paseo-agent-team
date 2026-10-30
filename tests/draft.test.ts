import { describe, expect, it } from "vitest";
import { foldersText, newRole, parseFolders } from "../shared/draft";
import type { ProviderInfo } from "../shared/validate";

const catalog: ProviderInfo[] = [
  { id: "copilot", ready: false, status: "unavailable", models: [{ id: "x", label: "x" }] },
  { id: "codex", ready: true, status: "ready", models: [{ id: "gpt-6.1-sol", label: "GPT-6.1-Sol" }] },
];

describe("parseFolders / foldersText", () => {
  it("splits on commas, trims and drops empty entries", () => {
    expect(parseFolders(" src/ui, ,assets/images ,")).toEqual(["src/ui", "assets/images"]);
  });

  it("joins folders back for editing", () => {
    expect(foldersText(["src/ui", "assets"])).toBe("src/ui, assets");
  });
});

describe("newRole", () => {
  it("uses the first ready provider and its first model, with a name not already taken", () => {
    expect(newRole(catalog, ["role-1"])).toEqual({ name: "role-2", workspace: "", provider: "codex", model: "gpt-6.1-sol", folders: [], instructions: "" });
  });

  it("leaves provider and model empty when nothing is ready", () => {
    expect(newRole([], [])).toMatchObject({ name: "role-1", provider: "", model: "" });
  });

  it("leaves the workspace empty so the role shares the orchestrator's", () => {
    expect(newRole(catalog, []).workspace).toBe("");
    expect(newRole([], []).workspace).toBe("");
  });
});
