import type { Option, Redacted } from "effect";
import { Config, Context, Layer } from "effect";

export interface EmailConfigShape {
  readonly apiKey: Option.Option<Redacted.Redacted<string>>;
  readonly appName: string;
  readonly from: string;
}

export class EmailConfig extends Context.Tag("@sphynx/email/EmailConfig")<
  EmailConfig,
  EmailConfigShape
>() {}

export const EmailConfigLive = Layer.effect(
  EmailConfig,
  Config.all({
    apiKey: Config.option(Config.redacted("RESEND_API_KEY")),
    appName: Config.string("EMAIL_APP_NAME").pipe(Config.withDefault("Sphynx")),
    from: Config.string("EMAIL_FROM").pipe(
      Config.withDefault("Sphynx <onboarding@resend.dev>")
    ),
  })
);
