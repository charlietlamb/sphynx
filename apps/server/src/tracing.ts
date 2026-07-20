import { Config, Effect, Layer, Tracer } from "effect";

/**
 * Turns the `Effect.withSpan` calls already scattered through the services into
 * timing logs, without pulling in an OTel collector. Off unless TRACE_SPANS is
 * set, so production pays nothing.
 *
 * Spans log on end with their duration and parent, which is enough to see which
 * GitHub calls dominate a request and how much they actually overlap.
 */
const makeTracer = () =>
  Tracer.make({
    context(f) {
      return f();
    },
    span(name, parent, context, links, startTime, kind) {
      const attributes = new Map<string, unknown>();
      const span: Tracer.Span = {
        _tag: "Span",
        spanId: `${name}-${startTime}`,
        traceId: "trace",
        name,
        sampled: true,
        parent,
        context,
        links,
        kind,
        status: { _tag: "Started", startTime },
        attributes,
        attribute(key, value) {
          attributes.set(key, value);
        },
        event() {
          // events are not surfaced by this tracer
        },
        addLinks() {
          // links are not surfaced by this tracer
        },
        end(endTime, exit) {
          const ms = Number(endTime - startTime) / 1_000_000;
          const parentName =
            parent._tag === "Some" && parent.value._tag === "Span"
              ? parent.value.name
              : "-";
          const failed = exit._tag === "Failure" ? " FAILED" : "";
          process.stdout.write(
            `[span] ${ms.toFixed(1).padStart(8)}ms  ${name}  (parent: ${parentName})${failed}\n`
          );
        },
      };
      return span;
    },
  });

export const TracingLive = Layer.unwrapEffect(
  Config.boolean("TRACE_SPANS").pipe(
    Config.withDefault(false),
    Effect.map((enabled) =>
      enabled ? Layer.setTracer(makeTracer()) : Layer.empty
    )
  )
);
