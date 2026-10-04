import type { Validator } from "./types";

export const named = (name: string, validator: Validator): Validator => {
  if (name.trim() === "") {
    throw new TypeError(
      'named() needs a name, such as named("reports created", check).'
    );
  }

  const wrapped: Validator = (context) => validator(context);

  return Object.defineProperty(wrapped, "name", { value: name });
};
