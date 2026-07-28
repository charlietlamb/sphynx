/**
 * The conversation reading column: left-anchored, capped so comment text stays a
 * comfortable line length, with the rail set in from the card edge. Shared by the
 * live feed and its skeleton so the two never drift and the load never shifts.
 */
export const CONVERSATION_MEASURE = "w-full max-w-[52rem] px-8";
