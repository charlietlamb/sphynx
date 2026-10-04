import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { MessageStreamEvent } from "eve/client";
import {
  type EveEmit,
  type EveState,
  initialEveState,
  reduceEve,
} from "../../src/runner/eve";

const recorded = (): MessageStreamEvent[] =>
  readFileSync(
    join(import.meta.dir, "fixtures/eve-session-created.ndjson"),
    "utf8"
  )
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as MessageStreamEvent);

const reduceAll = (events: readonly MessageStreamEvent[]) =>
  events.reduce<{ emits: EveEmit[]; state: EveState }>(
    (acc, event) => {
      const step = reduceEve(acc.state, event);
      return { emits: [...acc.emits, ...step.emits], state: step.state };
    },
    { emits: [], state: initialEveState }
  );

const meta = (id: string) => ({ at: "2026-10-02T10:00:00.000Z", id });
const turn = { sequence: 0, turnId: "turn_0" };

const constructed = (
  events: readonly { data?: unknown; type: string }[]
): MessageStreamEvent[] =>
  events.map(
    (event, index) =>
      ({ ...event, meta: meta(`evt_${index}`) }) as MessageStreamEvent
  );

describe("reduceEve on a recorded eve session", () => {
  const { emits, state } = reduceAll(recorded());

  test("pairs the seven tool calls by call id in order", () => {
    expect(
      emits.flatMap((emit) =>
        emit._tag === "toolCall"
          ? [[emit.call.name, emit.call.callId, emit.call.status]]
          : []
      )
    ).toEqual([
      ["list_available_skills", "call_BfdWwmGLBl0tIy1wsXs5M0ZZ", "completed"],
      ["get_skill_by_name", "call_qmJP1vK7syMZ0GiPNyIIu5ob", "completed"],
      ["get_brand_references", "call_GVtDnVFMipHckXVK6T0XmM2L", "completed"],
      ["get_pull_requests", "call_7VaJx9WLCL2o9FVR3xNjae5l", "completed"],
      ["list_available_skills", "call_vDn7Rx1HtYPvjYK7gt9Z3bCS", "completed"],
      ["get_skill_by_name", "call_X0kWrKpt6T9qHHFvgHdI5ssF", "completed"],
      ["create_post", "call_R22HEAwwcscVAUxxaM3cYpPP", "completed"],
    ]);
    expect(state.pending.size).toBe(0);
  });

  test("carries the requested input and the result output on one call", () => {
    expect(
      emits.find(
        (emit) => emit._tag === "toolCall" && emit.call.name === "create_post"
      )
    ).toEqual({
      _tag: "toolCall",
      call: {
        callId: "call_R22HEAwwcscVAUxxaM3cYpPP",
        error: undefined,
        input: {
          markdown:
            "Two updates to make signing in and scheduled posting more reliable.\n\n## New\n- Business plan teams can sign in with SAML SSO through Okta or Google Workspace.\n\n## Fixed\n- Retried schedules no longer create duplicate posts.",
          recommendations: null,
          title: "SSO sign in and duplicate post fixes",
        },
        name: "create_post",
        output: { postId: "post_fixture_1", status: "created" },
        status: "completed",
      },
    });
  });

  test("reports usage for each of the eight steps", () => {
    const usage = emits.flatMap((emit) =>
      emit._tag === "usage" ? [emit.counts] : []
    );

    const total = (key: keyof (typeof usage)[number]) =>
      usage.reduce((sum, counts) => sum + (counts[key] ?? 0), 0);

    expect(usage.length).toBe(8);
    expect({
      cacheReadTokens: total("cacheReadTokens"),
      cacheWriteTokens: total("cacheWriteTokens"),
      inputTokens: total("inputTokens"),
      outputTokens: total("outputTokens"),
    }).toEqual({
      cacheReadTokens: 4608,
      cacheWriteTokens: 0,
      inputTokens: 17_077,
      outputTokens: 592,
    });
  });

  test("ends with the structured answer then finished completed", () => {
    expect(emits.slice(-2)).toEqual([
      {
        _tag: "message",
        text: '{"status":"created","posts":[{"postId":"post_fixture_1","title":"SSO sign in and duplicate post fixes"}]}',
      },
      { _tag: "finished", reason: "completed" },
    ]);
    expect(state.outcome).toEqual({ status: "completed" });
  });
});

describe("the answer an eve session ends with", () => {
  const result = {
    posts: [{ postId: "post_1", title: "SSO sign in" }],
    status: "created",
  };
  const answerOf = (
    events: readonly { data?: unknown; type: string }[]
  ): readonly EveEmit[] =>
    reduceAll(
      constructed([
        ...events,
        { data: { sessionId: "s1" }, type: "session.completed" },
      ])
    ).emits;
  const said = (message: string) => ({
    data: { ...turn, finishReason: "stop", message, stepIndex: 0 },
    type: "message.completed",
  });
  const structured = {
    data: { ...turn, result, stepIndex: 0 },
    type: "result.completed",
  };

  test.each([
    ["wrapped in final_output", JSON.stringify({ final_output: result })],
    ["after a final_output label", `final_output:\n${JSON.stringify(result)}`],
  ])("is the structured result when the text is %s", (_, text) => {
    expect(answerOf([said(text), structured])).toEqual([
      {
        _tag: "message",
        text: '{"posts":[{"postId":"post_1","title":"SSO sign in"}],"status":"created"}',
      },
      { _tag: "finished", reason: "completed" },
    ]);
  });

  test("is the last message when the agent has no output schema", () => {
    expect(answerOf([said("Posted the changelog.")])).toEqual([
      { _tag: "message", text: "Posted the changelog." },
      { _tag: "finished", reason: "completed" },
    ]);
  });
});

describe("reduceEve on constructed events", () => {
  test("constructed failed turn finishes failed and never emits the answer", () => {
    const { emits, state } = reduceAll(
      constructed([
        { data: { runtime: {} }, type: "session.started" },
        {
          data: {
            ...turn,
            finishReason: "stop",
            message: "partial",
            stepIndex: 0,
          },
          type: "message.completed",
        },
        {
          data: {
            ...turn,
            code: "model_error",
            message: "HTTP 400: model not supported",
          },
          type: "turn.failed",
        },
        {
          data: { continuationToken: "wrun_1", wait: "next-user-message" },
          type: "session.waiting",
        },
      ])
    );

    expect(emits).toEqual([
      { _tag: "finished", reason: "failed: HTTP 400: model not supported" },
    ]);
    expect(state.outcome).toEqual({
      reason: "HTTP 400: model not supported",
      status: "failed",
    });
  });

  test("constructed failed session finishes with its message", () => {
    const { emits } = reduceAll(
      constructed([
        {
          data: { code: "crashed", message: "sandbox lost", sessionId: "s1" },
          type: "session.failed",
        },
      ])
    );

    expect(emits).toEqual([
      { _tag: "finished", reason: "failed: sandbox lost" },
    ]);
  });

  test("constructed approval request parks with what it asked", () => {
    const action = {
      callId: "call_1",
      input: { markdown: "hi", title: "Hi" },
      kind: "tool-call",
      toolName: "create_post",
    };
    const { emits, state } = reduceAll(
      constructed([
        {
          data: { ...turn, actions: [action], stepIndex: 0 },
          type: "actions.requested",
        },
        {
          data: {
            ...turn,
            requests: [
              {
                action,
                kind: "tool-approval",
                prompt: "Approve create_post?",
                requestId: "req_1",
              },
            ],
            stepIndex: 0,
          },
          type: "input.requested",
        },
        {
          data: { continuationToken: "wrun_1", wait: "next-user-message" },
          type: "session.waiting",
        },
      ])
    );

    expect(emits).toEqual([
      {
        _tag: "finished",
        reason: "parked: tool-approval on create_post: Approve create_post?",
      },
    ]);
    expect(state.outcome?.status).toBe("parked");
  });

  test("an unknown event type emits nothing and keeps the state", () => {
    const step = reduceEve(
      initialEveState,
      constructed([{ data: {}, type: "future.event" }])[0] as MessageStreamEvent
    );

    expect(step).toEqual({ emits: [], state: initialEveState });
  });
});
