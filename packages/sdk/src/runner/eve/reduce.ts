import type { MessageStreamEvent } from "eve/client";
import type { ToolCallInput, UsageCounts } from "../index";
import { type EveOutcome, finishedReason } from "./outcome";

type EveEventType = MessageStreamEvent["type"];
type EveEventOf<T extends EveEventType> = Extract<
  MessageStreamEvent,
  { type: T }
>;
type ActionRequest = EveEventOf<"actions.requested">["data"]["actions"][number];

export type EveEmit =
  | { readonly _tag: "finished"; readonly reason: string }
  | { readonly _tag: "message"; readonly text: string }
  | { readonly _tag: "toolCall"; readonly call: ToolCallInput }
  | { readonly _tag: "usage"; readonly counts: UsageCounts };

interface PendingCall {
  readonly input: unknown;
  readonly name: string;
}

export interface EveState {
  readonly answer: string | undefined;
  readonly outcome: EveOutcome | undefined;
  readonly pending: ReadonlyMap<string, PendingCall>;
  readonly result: string | undefined;
}

export interface EveStep {
  readonly emits: readonly EveEmit[];
  readonly state: EveState;
}

export const initialEveState: EveState = {
  answer: undefined,
  outcome: undefined,
  pending: new Map(),
  result: undefined,
};

const actionName = (action: ActionRequest): string => {
  if ("toolName" in action) {
    return action.toolName;
  }

  return "name" in action ? action.name : action.kind;
};

const settle = (state: EveState, outcome: EveOutcome): EveStep => {
  const text = state.result ?? state.answer;
  const answer: EveEmit[] =
    outcome.status === "completed" && text !== undefined
      ? [{ _tag: "message", text }]
      : [];

  return {
    emits: [...answer, { _tag: "finished", reason: finishedReason(outcome) }],
    state: { ...state, outcome },
  };
};

const unchanged = (state: EveState): EveStep => ({ emits: [], state });

type Handlers = {
  readonly [T in EveEventType]?: (
    state: EveState,
    event: EveEventOf<T>
  ) => EveStep;
};

const handlers: Handlers = {
  "action.result": (state, { data }) => {
    const { callId } = data.result;
    const pending = state.pending.get(callId);
    const rest = new Map(state.pending);
    rest.delete(callId);

    return {
      emits: [
        {
          _tag: "toolCall",
          call: {
            callId,
            error: data.error?.message,
            input: pending?.input ?? null,
            name:
              pending?.name ??
              ("toolName" in data.result ? data.result.toolName : "unknown"),
            output: data.result.output,
            status: data.status,
          },
        },
      ],
      state: { ...state, pending: rest },
    };
  },
  "actions.requested": (state, { data }) => {
    const pending = new Map(state.pending);

    for (const action of data.actions) {
      pending.set(action.callId, {
        input: action.input,
        name: actionName(action),
      });
    }

    return { emits: [], state: { ...state, pending } };
  },
  "authorization.required": (state, { data }) =>
    settle(state, {
      reason: `authorization required for ${data.name}`,
      status: "parked",
    }),
  "input.requested": (state, { data }) =>
    settle(state, {
      reason: data.requests
        .map(
          (request) =>
            `${request.kind} on ${request.action.toolName}: ${request.prompt}`
        )
        .join("; "),
      status: "parked",
    }),
  "message.completed": (state, { data }) =>
    data.finishReason === "tool-calls" || data.message === null
      ? unchanged(state)
      : unchanged({ ...state, answer: data.message }),
  "result.completed": (state, { data }) =>
    unchanged({ ...state, result: JSON.stringify(data.result) }),
  "session.completed": (state) => settle(state, { status: "completed" }),
  "session.failed": (state, { data }) =>
    settle(state, { reason: data.message, status: "failed" }),
  "session.waiting": (state, { data }) =>
    data.wait === "next-user-message"
      ? settle(state, { status: "completed" })
      : unchanged(state),
  "step.completed": (state, { data }) =>
    data.usage === undefined
      ? unchanged(state)
      : {
          emits: [
            {
              _tag: "usage",
              counts: {
                cacheReadTokens: data.usage.cacheReadTokens ?? 0,
                cacheWriteTokens: data.usage.cacheWriteTokens ?? 0,
                inputTokens: data.usage.inputTokens ?? 0,
                outputTokens: data.usage.outputTokens ?? 0,
              },
            },
          ],
          state,
        },
  "turn.failed": (state, { data }) =>
    settle(state, { reason: data.message, status: "failed" }),
};

export const reduceEve = (
  state: EveState,
  event: MessageStreamEvent
): EveStep => {
  const handler = handlers[event.type] as
    | ((state: EveState, event: MessageStreamEvent) => EveStep)
    | undefined;

  if (state.outcome !== undefined || handler === undefined) {
    return unchanged(state);
  }

  return handler(state, event);
};
