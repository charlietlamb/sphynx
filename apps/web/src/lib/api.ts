import { Schema } from "effect";

export async function postJson(url: string, body?: object): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return response.json();
}

export async function postDecoded<A, I>(
  url: string,
  schema: Schema.Schema<A, I>,
  body?: object
): Promise<A> {
  return await Schema.decodeUnknownPromise(schema)(await postJson(url, body));
}
