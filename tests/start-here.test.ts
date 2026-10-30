import { describe, expect, it } from "vitest";
import { teamStartHereRpc } from "../shared/rpc";

describe("teamStartHereRpc", () => {
  it("is named like the other team RPCs", () => {
    expect(teamStartHereRpc.name).toBe("team.start-here");
  });

  it("takes the workspace to start the orchestrator in", () => {
    expect(teamStartHereRpc.input.safeParse({ workspaceId: "wks_1" }).success).toBe(true);
  });

  it("rejects an input without a target", () => {
    expect(teamStartHereRpc.input.safeParse({}).success).toBe(false);
    expect(teamStartHereRpc.input.safeParse({ workspaceId: 1 }).success).toBe(false);
  });

  it("returns the orchestrator and whether it was created", () => {
    expect(teamStartHereRpc.output.safeParse({ ok: true, orchestratorAgentId: "agt_1", created: true }).success).toBe(true);
    expect(teamStartHereRpc.output.safeParse({ ok: true, orchestratorAgentId: "agt_1", created: false }).success).toBe(true);
  });

  it("returns errors when it cannot start", () => {
    expect(teamStartHereRpc.output.safeParse({ ok: false, errors: ["no team file"] }).success).toBe(true);
  });

  it("rejects malformed outputs", () => {
    expect(teamStartHereRpc.output.safeParse({ ok: true, orchestratorAgentId: "agt_1" }).success).toBe(false);
    expect(teamStartHereRpc.output.safeParse({ ok: true, created: true }).success).toBe(false);
    expect(teamStartHereRpc.output.safeParse({ ok: false }).success).toBe(false);
    expect(teamStartHereRpc.output.safeParse({ ok: false, errors: "no team file" }).success).toBe(false);
  });
});
