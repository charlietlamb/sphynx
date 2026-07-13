export const serverUrl = () =>
  process.env.AUTH_SERVER_URL ?? process.env.BETTER_AUTH_URL ?? "";
