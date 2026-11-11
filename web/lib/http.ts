// The API's types (lib/api-types.ts, generated from its OpenAPI document) and the error every fetch helper throws.
import type { components } from "./api-types";

export type Schemas = components["schemas"];

export class ApiError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`API ${status}`);
  }
}
