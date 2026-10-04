import { type AgentInfoResult, Client, type SendTurnInput } from "eve/client";
import { createEmitter, type Emitter } from "../index";
import { type EveOutcome, finishedReason } from "./outcome";
import { type EveEmit, initialEveState, reduceEve } from "./reduce";

export interface RunEveOptions {
  readonly emitter?: Emitter;
  readonly model?: string;
  readonly prompt: string;
  readonly url: string;
}

const applyEmit = (emitter: Emitter, emit: EveEmit) => {
  switch (emit._tag) {
    case "finished":
      return emitter.finished(emit.reason);
    case "message":
      return emitter.message({ text: emit.text });
    case "toolCall":
      return emitter.toolCall(emit.call);
    case "usage":
      return emitter.usage(emit.counts);
    default:
      return emit satisfies never;
  }
};

type OutputSchema = NonNullable<SendTurnInput["outputSchema"]>;

const isSchema = (value: unknown): value is OutputSchema =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const turnFor = (
  prompt: string,
  info: Pick<AgentInfoResult, "agent">
): SendTurnInput =>
  isSchema(info.agent.outputSchema)
    ? { message: prompt, outputSchema: info.agent.outputSchema }
    : { message: prompt };

const streamEnded: EveOutcome = {
  reason: "the eve stream ended before the session settled",
  status: "failed",
};

export const runEve = async ({
  emitter = createEmitter(),
  model,
  prompt,
  url,
}: RunEveOptions): Promise<EveOutcome> => {
  const client = new Client({ host: url });
  const { response } = await client.sessions.create(
    turnFor(prompt, await client.info())
  );

  if (model !== undefined) {
    emitter.started({ model, sessionId: response.sessionId });
  }

  let state = initialEveState;

  for await (const event of response) {
    const step = reduceEve(state, event);
    state = step.state;

    for (const emit of step.emits) {
      applyEmit(emitter, emit);
    }

    if (state.outcome !== undefined) {
      return state.outcome;
    }
  }

  emitter.finished(finishedReason(streamEnded));
  return streamEnded;
};
