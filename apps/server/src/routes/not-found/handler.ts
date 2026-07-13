import { ErrorResponseSchema } from "@sphynx/schema/api";
import { json } from "../../http/json";

export const handleNotFound = () =>
  json(ErrorResponseSchema, { error: "Not found" }, { status: 404 });
