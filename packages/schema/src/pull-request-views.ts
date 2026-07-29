import { Schema } from "effect";

export const ViewedFileSchema = Schema.Struct({
  path: Schema.String,
  viewed: Schema.Boolean,
});

export type ViewedFile = typeof ViewedFileSchema.Type;

export const ViewedFilesSchema = Schema.Struct({
  files: Schema.Array(ViewedFileSchema),
});
