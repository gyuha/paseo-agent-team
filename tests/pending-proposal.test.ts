import { describe, expect, it } from "vitest";
import { LABEL, PROPOSAL_FOR, pendingPlanners, proposalTarget } from "../shared/cleanup";
import { teamPendingProposalRpc, teamProposalCancelRpc } from "../shared/rpc";

const planner = (id: string, target: string, createdAt: string, extra: { archivedAt?: string | null; labels?: Record<string, string> } = {}) => ({
  id,
  createdAt,
  archivedAt: extra.archivedAt ?? null,
  labels: extra.labels ?? { [LABEL]: "planner", [PROPOSAL_FOR]: target },
});

describe("proposalTarget", () => {
  it("is the workspace id or the project id", () => {
    expect(proposalTarget({ workspaceId: "wks_1" })).toBe("wks_1");
    expect(proposalTarget({ projectId: "prj_1" })).toBe("prj_1");
  });
});

describe("pendingPlanners", () => {
  it("returns the target's unarchived team planners, newest first", () => {
    const agents = [
      planner("old", "wks_1", "2026-10-30T10:00:00Z"),
      planner("new", "wks_1", "2026-10-30T11:00:00Z"),
      planner("archived", "wks_1", "2026-10-30T12:00:00Z", { archivedAt: "2026-10-30T12:05:00Z" }),
      planner("other", "wks_2", "2026-10-30T13:00:00Z"),
      planner("role", "wks_1", "2026-10-30T14:00:00Z", { labels: { [LABEL]: "planner" } }),
      planner("orchestrator", "wks_1", "2026-10-30T15:00:00Z", { labels: { [LABEL]: "orchestrator", [PROPOSAL_FOR]: "wks_1" } }),
    ];
    expect(pendingPlanners(agents, "wks_1")).toEqual(["new", "old"]);
  });

  it("returns nothing when the target has no team planner", () => {
    expect(pendingPlanners([planner("other", "wks_2", "2026-10-30T13:00:00Z")], "wks_1")).toEqual([]);
  });
});

describe("pending proposal RPC contracts", () => {
  it("looks up a workspace's or a project's pending proposal", () => {
    expect(teamPendingProposalRpc.name).toBe("team.proposal.pending");
    expect(teamPendingProposalRpc.input.safeParse({ workspaceId: "wks_1" }).success).toBe(true);
    expect(teamPendingProposalRpc.input.safeParse({ projectId: "prj_1" }).success).toBe(true);
    expect(teamPendingProposalRpc.output.safeParse({ agentId: "a1" }).success).toBe(true);
    expect(teamPendingProposalRpc.output.safeParse({ agentId: null }).success).toBe(true);
  });

  it("cancels a workspace's or a project's proposal", () => {
    expect(teamProposalCancelRpc.name).toBe("team.proposal.cancel");
    expect(teamProposalCancelRpc.input.safeParse({ workspaceId: "wks_1" }).success).toBe(true);
    expect(teamProposalCancelRpc.input.safeParse({ projectId: "prj_1" }).success).toBe(true);
    expect(teamProposalCancelRpc.input.safeParse({}).success).toBe(false);
  });
});
