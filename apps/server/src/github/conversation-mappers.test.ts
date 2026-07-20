import { describe, expect, test } from "bun:test";
import {
  toConversation,
  toConversationEvent,
  toRestComment,
  toRestConversation,
} from "./conversation-mappers";

const author = { login: "octocat", avatarUrl: "https://avatars.test/octocat" };

const graphqlComment = {
  id: "IC_node",
  fullDatabaseId: "12345",
  body: "Looks good",
  bodyHTML: "<p>Looks good</p>",
  createdAt: "2026-07-01T10:00:00Z",
  url: "https://github.com/o/r/pull/1#issuecomment-12345",
  author,
};

const graphqlReview = (overrides: Record<string, unknown> = {}) => ({
  id: "PRR_node",
  fullDatabaseId: "67890",
  state: "APPROVED",
  body: "Ship it",
  bodyHTML: "<p>Ship it</p>",
  submittedAt: "2026-07-02T10:00:00Z",
  url: "https://github.com/o/r/pull/1#pullrequestreview-67890",
  author,
  comments: { totalCount: 2 },
  ...overrides,
});

const nodes = (overrides: Record<string, unknown> = {}) => ({
  bodyHTML: "<p>Description</p>",
  comments: { nodes: [graphqlComment] },
  reviews: { nodes: [graphqlReview()] },
  timelineItems: { nodes: [] },
  ...overrides,
});

describe("toConversation", () => {
  test("maps comments and reviews with database ids", () => {
    const conversation = toConversation(nodes());
    expect(conversation.descriptionHTML).toBe("<p>Description</p>");
    expect(conversation.comments).toEqual([
      {
        id: "12345",
        author,
        body: "Looks good",
        bodyHTML: "<p>Looks good</p>",
        createdAt: "2026-07-01T10:00:00Z",
        githubUrl: "https://github.com/o/r/pull/1#issuecomment-12345",
      },
    ]);
    expect(conversation.reviews).toEqual([
      {
        id: "67890",
        author,
        verdict: "approved",
        body: "Ship it",
        bodyHTML: "<p>Ship it</p>",
        submittedAt: "2026-07-02T10:00:00Z",
        githubUrl: "https://github.com/o/r/pull/1#pullrequestreview-67890",
        commentCount: 2,
      },
    ]);
  });

  test("falls back to node id when fullDatabaseId is missing", () => {
    const conversation = toConversation(
      nodes({
        comments: { nodes: [{ ...graphqlComment, fullDatabaseId: null }] },
      })
    );
    expect(conversation.comments[0]?.id).toBe("IC_node");
  });

  test("maps every verdict and drops pending reviews", () => {
    const conversation = toConversation(
      nodes({
        reviews: {
          nodes: [
            graphqlReview({ state: "CHANGES_REQUESTED" }),
            graphqlReview({ state: "DISMISSED" }),
            graphqlReview({ state: "PENDING" }),
            graphqlReview({ state: "PENDING", submittedAt: null }),
          ],
        },
      })
    );
    expect(conversation.reviews.map((review) => review.verdict)).toEqual([
      "changes-requested",
      "dismissed",
    ]);
  });

  test("drops empty commented reviews with no comments", () => {
    const conversation = toConversation(
      nodes({
        reviews: {
          nodes: [
            graphqlReview({
              state: "COMMENTED",
              body: "  ",
              comments: { totalCount: 0 },
            }),
            graphqlReview({
              state: "COMMENTED",
              body: "",
              comments: { totalCount: 3 },
            }),
          ],
        },
      })
    );
    expect(conversation.reviews).toHaveLength(1);
    expect(conversation.reviews[0]?.commentCount).toBe(3);
  });

  test("keeps null authors", () => {
    const conversation = toConversation(
      nodes({ comments: { nodes: [{ ...graphqlComment, author: null }] } })
    );
    expect(conversation.comments[0]?.author).toBeNull();
  });
});

describe("toConversationEvent", () => {
  test("maps commit nodes using the commit author and date", () => {
    const event = toConversationEvent({
      __typename: "PullRequestCommit",
      id: "PRC_1",
      url: "https://github.com/o/r/pull/1/commits/abc1234",
      commit: {
        abbreviatedOid: "abc1234",
        messageHeadline: "fix: things",
        committedDate: "2026-07-03T10:00:00Z",
        author: { user: author },
      },
    });
    expect(event).toEqual({
      id: "PRC_1",
      kind: "commit",
      at: "2026-07-03T10:00:00Z",
      actor: author,
      detail: "fix: things",
      ref: "abc1234",
      url: "https://github.com/o/r/pull/1/commits/abc1234",
    });
  });

  test("maps label, merge and rename nodes", () => {
    expect(
      toConversationEvent({
        __typename: "LabeledEvent",
        id: "LE_1",
        createdAt: "2026-07-03T11:00:00Z",
        actor: author,
        label: { name: "bug" },
      })?.detail
    ).toBe("bug");
    const merged = toConversationEvent({
      __typename: "MergedEvent",
      id: "ME_1",
      createdAt: "2026-07-04T11:00:00Z",
      actor: author,
      commit: { abbreviatedOid: "def5678" },
    });
    expect(merged?.kind).toBe("merged");
    expect(merged?.ref).toBe("def5678");
    expect(
      toConversationEvent({
        __typename: "RenamedTitleEvent",
        id: "RE_1",
        createdAt: "2026-07-04T12:00:00Z",
        actor: author,
        currentTitle: "New title",
      })?.detail
    ).toBe("New title");
  });

  test("maps review requests for users and teams", () => {
    expect(
      toConversationEvent({
        __typename: "ReviewRequestedEvent",
        id: "RR_1",
        createdAt: "2026-07-03T12:00:00Z",
        actor: author,
        requestedReviewer: { login: "reviewer" },
      })?.detail
    ).toBe("reviewer");
    expect(
      toConversationEvent({
        __typename: "ReviewRequestedEvent",
        id: "RR_2",
        createdAt: "2026-07-03T12:00:00Z",
        actor: author,
        requestedReviewer: { name: "core-team" },
      })?.detail
    ).toBe("core-team");
  });

  test("skips unknown nodes without throwing", () => {
    expect(toConversationEvent({ __typename: "UnknownEvent" })).toBeNull();
    expect(toConversationEvent(null)).toBeNull();
  });
});

describe("rest fallback", () => {
  const restComment = {
    id: 555,
    body: "From REST",
    user: { login: "octocat", avatar_url: "https://avatars.test/octocat" },
    created_at: "2026-07-01T10:00:00Z",
    html_url: "https://github.com/o/r/pull/1#issuecomment-555",
  };

  test("maps rows with null bodyHTML and empty events", () => {
    const conversation = toRestConversation(
      [restComment],
      [
        {
          id: 777,
          state: "CHANGES_REQUESTED",
          body: "Needs work",
          user: restComment.user,
          submitted_at: "2026-07-02T10:00:00Z",
          html_url: "https://github.com/o/r/pull/1#pullrequestreview-777",
        },
      ]
    );
    expect(conversation.descriptionHTML).toBeNull();
    expect(conversation.events).toEqual([]);
    expect(conversation.comments[0]).toEqual({
      id: "555",
      author,
      body: "From REST",
      bodyHTML: null,
      createdAt: "2026-07-01T10:00:00Z",
      githubUrl: "https://github.com/o/r/pull/1#issuecomment-555",
    });
    expect(conversation.reviews[0]?.verdict).toBe("changes-requested");
  });

  test("drops pending rest reviews but keeps empty commented ones", () => {
    const conversation = toRestConversation(
      [],
      [
        {
          id: 1,
          state: "PENDING",
          body: "draft",
          user: restComment.user,
          submitted_at: null,
          html_url: "https://github.com/x",
        },
        {
          id: 2,
          state: "COMMENTED",
          body: null,
          user: restComment.user,
          submitted_at: "2026-07-02T10:00:00Z",
          html_url: "https://github.com/y",
        },
      ]
    );
    expect(conversation.reviews).toHaveLength(1);
    expect(conversation.reviews[0]?.id).toBe("2");
    expect(conversation.reviews[0]?.body).toBe("");
  });

  test("toRestComment coalesces null body", () => {
    expect(toRestComment({ ...restComment, body: null }).body).toBe("");
  });
});
