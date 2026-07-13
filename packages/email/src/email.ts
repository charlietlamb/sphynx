import { Context, Effect, Layer, Option, Redacted } from "effect";
import { Resend } from "resend";
import { EmailConfig } from "./config";

export interface MagicLinkEmail {
  readonly email: string;
  readonly url: string;
}

export interface EmailShape {
  readonly sendMagicLink: (
    input: MagicLinkEmail
  ) => Effect.Effect<void, unknown>;
}

export class Email extends Context.Tag("@sphynx/email/Email")<
  Email,
  EmailShape
>() {}

const magicLinkText = (appName: string, url: string) =>
  `Sign in to ${appName}\n\nOpen this link to continue:\n${url}\n\nIf you did not request this, you can ignore this email.`;

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const magicLinkHtml = (appName: string, url: string) => `
  <p>Open this link to sign in to ${escapeHtml(appName)}:</p>
  <p><a href="${escapeHtml(url)}">Sign in to ${escapeHtml(appName)}</a></p>
  <p>If you did not request this, you can ignore this email.</p>
`;

export const EmailLive = Layer.effect(
  Email,
  Effect.gen(function* () {
    const config = yield* EmailConfig;
    const resend = Option.map(
      config.apiKey,
      (apiKey) => new Resend(Redacted.value(apiKey))
    ).pipe(Option.getOrUndefined);

    const sendMagicLink = ({ email, url }: MagicLinkEmail) =>
      resend
        ? Effect.tryPromise({
            catch: (cause) => cause,
            try: () =>
              resend.emails.send({
                from: config.from,
                html: magicLinkHtml(config.appName, url),
                subject: `Sign in to ${config.appName}`,
                text: magicLinkText(config.appName, url),
                to: email,
              }),
          }).pipe(
            Effect.timeout("10 seconds"),
            Effect.asVoid,
            Effect.tapError((cause) =>
              Effect.logError("Failed to send magic link", { cause, email })
            )
          )
        : Effect.logWarning("RESEND_API_KEY is not configured", {
            email,
          });

    return { sendMagicLink };
  })
);
