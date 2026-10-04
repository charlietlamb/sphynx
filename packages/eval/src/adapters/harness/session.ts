import type {
  HarnessEvent,
  HarnessUsage,
} from "@sphynx/schema/domain/harness-event";
import { Effect, Option, Ref, Stream } from "effect";
import { HarnessUnavailable } from "../../domain/errors";
import { reportsModel } from "../../domain/harness-models";
import { EMPTY_TALLY, tallied, totalOf } from "../../domain/usage-tally";
import type { HarnessSessionShape, RunHarness } from "../../ports/harness";
import { noPending, paired } from "./item-timing";
import { type HarnessLine, harnessLines } from "./process";

export interface DecodedOutput {
  readonly closes?: string;
  readonly events?: readonly HarnessEvent[];
  readonly failure?: string;
  readonly model?: string;
  readonly opens?: string;
  readonly sessionId?: string;
  readonly usage?: HarnessUsage;
  readonly usageIsCumulative?: boolean;
}

export type LineDecoder = (line: string, at: number) => DecodedOutput;

export interface SessionOptions {
  readonly env?: Readonly<Record<string, string>>;
  readonly verifyModel?: boolean;
}

const unavailable = (request: RunHarness, reason: string) =>
  new HarnessUnavailable({ harness: request.harness, reason });

export const decoding = (
  request: RunHarness,
  decode: LineDecoder,
  verifyModel: boolean
) =>
  Effect.gen(function* () {
    const usage = yield* Ref.make(EMPTY_TALLY);
    const started = yield* Ref.make(false);
    const pending = yield* Ref.make(noPending);
    const failure = yield* Ref.make(Option.none<string>());

    const step = ({ at, line }: Pick<HarnessLine, "at" | "line">) =>
      Effect.gen(function* () {
        const decoded = decode(line, at);

        if (
          verifyModel &&
          decoded.model !== undefined &&
          !reportsModel(request.model, decoded.model)
        ) {
          return yield* Effect.fail(
            unavailable(
              request,
              `Harness reported model ${decoded.model} instead of ${request.model}`
            )
          );
        }

        const { usage: reported } = decoded;

        if (reported !== undefined) {
          yield* Ref.update(usage, (tally) =>
            tallied(tally, reported, decoded.usageIsCumulative ?? false)
          );
        }

        if (decoded.failure !== undefined) {
          yield* Ref.set(failure, Option.some(decoded.failure));
        }

        const events = yield* Ref.modify(pending, (current) => {
          const [next, timed] = paired(current, decoded, at);
          return [timed, next];
        });

        if (
          decoded.sessionId === undefined ||
          (yield* Ref.getAndSet(started, true))
        ) {
          return events;
        }

        return [
          {
            _tag: "Started",
            at,
            model: decoded.model ?? request.model,
            sessionId: decoded.sessionId,
          } satisfies HarnessEvent,
          ...events,
        ];
      });

    const failed = (error: HarnessUnavailable) =>
      Ref.get(failure).pipe(
        Effect.flatMap((reason) =>
          Effect.fail(
            Option.match(reason, {
              onNone: () => error,
              onSome: (found) => unavailable(request, found),
            })
          )
        )
      );

    const settled = Ref.get(failure).pipe(
      Effect.flatMap(
        Option.match({
          onNone: () => Effect.void,
          onSome: (found) => Effect.fail(unavailable(request, found)),
        })
      )
    );

    return {
      failed,
      settled,
      step,
      usage: Ref.get(usage).pipe(Effect.map(totalOf)),
    };
  });

export const jsonSession = (
  request: RunHarness,
  command: string,
  decode: LineDecoder,
  options: SessionOptions = {}
) =>
  Effect.gen(function* () {
    const session = yield* decoding(
      request,
      decode,
      options.verifyModel ?? false
    );

    return {
      events: harnessLines(
        request.harness,
        request.sandbox,
        command,
        options.env ?? request.env,
        { timeout: request.timeout }
      ).pipe(
        Stream.mapConcatEffect(session.step),
        Stream.catchAll((error) => Stream.fromEffect(session.failed(error)))
      ),
      harness: request.harness,
      usage: session.usage,
      version: request.harnessVersion,
    } satisfies HarnessSessionShape;
  });
