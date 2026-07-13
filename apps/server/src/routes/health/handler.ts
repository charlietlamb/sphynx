import { HealthResponseSchema } from "@sphynx/schema/api";
import { json } from "../../http/json";

export const handleHealth = () => json(HealthResponseSchema, { ok: true });
