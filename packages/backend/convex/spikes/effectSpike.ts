import { Context, Effect, Layer, Schema } from "effect";
import { v } from "convex/values";
import { internalAction } from "../_generated/server";

const RawPull = Schema.Struct({
  number: Schema.Number,
  title: Schema.String,
  additions: Schema.Number,
  deletions: Schema.Number,
});

class SizeClassifier extends Context.Tag("SizeClassifier")<
  SizeClassifier,
  { readonly classify: (total: number) => string }
>() {}

const SizeClassifierLive = Layer.succeed(SizeClassifier, {
  classify: (total) =>
    total < 50 ? "xs" : total < 200 ? "s" : total < 600 ? "m" : "l",
});

const decodePull = Schema.decodeUnknown(RawPull);

const classifyPull = (raw: unknown) =>
  Effect.gen(function* () {
    const pull = yield* decodePull(raw);
    const classifier = yield* SizeClassifier;
    return {
      number: pull.number,
      title: pull.title,
      size: classifier.classify(pull.additions + pull.deletions),
    };
  });

export const classify = internalAction({
  args: { raw: v.any() },
  returns: v.object({
    number: v.number(),
    title: v.string(),
    size: v.string(),
  }),
  handler: (_ctx, args) =>
    Effect.runPromise(
      classifyPull(args.raw).pipe(Effect.provide(SizeClassifierLive)),
    ),
});
