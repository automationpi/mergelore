import { describe, it, expect, vi } from "vitest";

vi.mock("@actions/core", () => ({
  info: vi.fn(),
  debug: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));

import { handleSlashCommand } from "../../src/handlers/slash-commands.js";

function makeMockOctokit() {
  return {
    rest: {
      reactions: {
        createForIssueComment: vi.fn().mockResolvedValue({}),
      },
      issues: {
        createComment: vi.fn().mockResolvedValue({}),
        addLabels: vi.fn().mockResolvedValue({}),
        createLabel: vi.fn().mockResolvedValue({}),
      },
    },
  } as any;
}

function makeContext(body: string, issueNumber = 5) {
  return {
    repo: { owner: "test", repo: "repo" },
    payload: {
      comment: {
        id: 100,
        body,
        user: { login: "alice" },
      },
      issue: { number: issueNumber },
    },
  } as any;
}

describe("handleSlashCommand", () => {
  it("ignores non-mergelore comments", async () => {
    const octokit = makeMockOctokit();
    await handleSlashCommand(octokit, makeContext("just a normal comment"));

    expect(octokit.rest.reactions.createForIssueComment).not.toHaveBeenCalled();
  });

  it("processes /mergelore-acknowledge", async () => {
    const octokit = makeMockOctokit();
    await handleSlashCommand(octokit, makeContext("/mergelore-acknowledge"));

    expect(octokit.rest.reactions.createForIssueComment).toHaveBeenCalledWith(
      expect.objectContaining({ content: "+1" }),
    );
    expect(octokit.rest.issues.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("acknowledged"),
      }),
    );
  });

  it("processes /mergelore-override with reason", async () => {
    const octokit = makeMockOctokit();
    await handleSlashCommand(
      octokit,
      makeContext("/mergelore-override This is intentional for the new auth flow"),
    );

    expect(octokit.rest.reactions.createForIssueComment).toHaveBeenCalled();

    const commentCall = octokit.rest.issues.createComment.mock.calls[0][0];
    expect(commentCall.body).toContain("overridden by @alice");
    expect(commentCall.body).toContain("This is intentional for the new auth flow");
    expect(commentCall.body).toContain("<!-- mergelore-override:");
  });

  it("rejects /mergelore-override without reason", async () => {
    const octokit = makeMockOctokit();
    await handleSlashCommand(octokit, makeContext("/mergelore-override"));

    const commentCall = octokit.rest.issues.createComment.mock.calls[0][0];
    expect(commentCall.body).toContain("requires a reason");
  });

  it("processes /mergelore-update-record", async () => {
    const octokit = makeMockOctokit();
    await handleSlashCommand(octokit, makeContext("/mergelore-update-record"));

    expect(octokit.rest.issues.addLabels).toHaveBeenCalledWith(
      expect.objectContaining({
        labels: ["mergelore:reindex"],
      }),
    );
    expect(octokit.rest.issues.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("re-indexed"),
      }),
    );
  });

  it("handles missing comment body gracefully", async () => {
    const octokit = makeMockOctokit();
    const context = {
      repo: { owner: "test", repo: "repo" },
      payload: { comment: { id: 1, body: null }, issue: { number: 1 } },
    } as any;

    await handleSlashCommand(octokit, context);
    expect(octokit.rest.reactions.createForIssueComment).not.toHaveBeenCalled();
  });
});
