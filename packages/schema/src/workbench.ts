/**
 * The workbench feed shapes are defined once as Convex validators in
 * `./read-model` and re-exported here as types. The client consumes the types
 * only; Convex validates the feed at the query boundary.
 */
export type { WorkbenchEvent, WorkbenchEventKind } from "./read-model";
