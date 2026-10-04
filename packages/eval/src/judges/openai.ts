import {
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "@effect/platform";
import { Effect, Option, Redacted, Schema } from "effect";
import { keepTagged } from "../adapters/keep-tagged";
import { modelAccessFor } from "../credentials/model-key";
import { CredentialResolver } from "../credentials/resolver";
import { describeError } from "../domain/failure";
import { promptInclusiveUsage } from "../domain/prompt-inclusive-usage";
import { JudgeFailed, type JudgeRequest } from "./model";
import { judgeEvidence, judgeInstructions, judgmentJsonSchema } from "./prompt";

const responseSchema = Schema.Struct({
  id: Schema.optional(Schema.String),
  model: Schema.optional(Schema.String),
  status: Schema.Literal("completed", "incomplete"),
  usage: Schema.optional(
    Schema.Struct({
      input_tokens: Schema.NonNegativeInt,
      input_tokens_details: Schema.optional(
        Schema.Struct({ cached_tokens: Schema.optional(Schema.NonNegativeInt) })
      ),
      output_tokens: Schema.NonNegativeInt,
      total_tokens: Schema.NonNegativeInt,
    })
  ),
  output: Schema.Array(
    Schema.Union(
      Schema.Struct({ type: Schema.Literal("reasoning") }),
      Schema.Struct({
        type: Schema.Literal("message"),
        content: Schema.Array(
          Schema.Union(
            Schema.Struct({
              type: Schema.Literal("output_text"),
              text: Schema.String,
            }),
            Schema.Struct({
              type: Schema.Literal("refusal"),
              refusal: Schema.String,
            })
          )
        ),
      })
    )
  ),
});

export const makeOpenAIJudge = Effect.gen(function* () {
  const client = (yield* HttpClient.HttpClient).pipe(HttpClient.filterStatusOk);
  const credentials = yield* CredentialResolver;

  return (request: JudgeRequest) =>
    Effect.gen(function* () {
      const access = yield* modelAccessFor(
        credentials,
        request.context.organizationId,
        request.judge.provider
      );

      if (Option.isNone(access)) {
        return yield* new JudgeFailed({
          message: `No ${request.judge.provider} model credential is configured`,
        });
      }
      const body = {
        model: request.judge.model,
        instructions: judgeInstructions(request),
        input: judgeEvidence(request),
        store: false,
        max_output_tokens: 2048,
        text: {
          format: {
            type: "json_schema",
            name: "judgment",
            strict: true,
            schema: judgmentJsonSchema(request),
          },
        },
      };
      if (request.onRequest) {
        yield* request.onRequest(body);
      }
      const httpRequest = yield* HttpClientRequest.post(
        `${access.value.provider.baseUrl}/responses`
      ).pipe(
        HttpClientRequest.bearerToken(Redacted.make(access.value.key)),
        HttpClientRequest.bodyJson(body)
      );
      const response = yield* client
        .execute(httpRequest)
        .pipe(
          Effect.flatMap(HttpClientResponse.schemaBodyJson(responseSchema))
        );
      const content = response.output.flatMap((item) =>
        item.type === "message" ? item.content : []
      );
      return {
        text: content
          .flatMap((item) => (item.type === "output_text" ? [item.text] : []))
          .join(""),
        responseId: response.id,
        model: response.model,
        refusal: content.find((item) => item.type === "refusal")?.refusal,
        incomplete: response.status === "incomplete",
        usage:
          response.usage === undefined
            ? undefined
            : promptInclusiveUsage({
                cached: response.usage.input_tokens_details?.cached_tokens ?? 0,
                output: response.usage.output_tokens,
                prompt: response.usage.input_tokens,
                total: response.usage.total_tokens,
              }),
      };
    }).pipe(
      Effect.scoped,
      keepTagged(
        "JudgeFailed",
        (error) =>
          new JudgeFailed({
            message: `The OpenAI judge could not complete: ${describeError(error)}`,
          })
      ),
      Effect.withSpan("OpenAIJudge.complete")
    );
});
