import type { EvalJournalEntry } from "@sphynx/schema/domain/eval-trial";
import { stepLine } from "./transcript-step";
import {
  openedTurn,
  repliedTurn,
  type Speaker,
  type Turn,
  turnFacts,
} from "./transcript-turn";
import { type Verdict, verdictLines } from "./transcript-verdict";
import {
  type TranscriptStyle,
  type Writer,
  writerFor,
} from "./transcript-writer";

export interface Spoken {
  readonly entry: EvalJournalEntry;
  readonly speaker: Speaker;
}

export interface Settled {
  readonly speaker: Speaker;
  readonly verdict: Verdict;
}

export interface Transcript {
  readonly closed: ReadonlySet<string>;
  readonly current: string | null;
  readonly turns: ReadonlyMap<string, Turn>;
}

export const EMPTY_TRANSCRIPT: Transcript = {
  closed: new Set(),
  current: null,
  turns: new Map(),
};

class Draft {
  readonly closed: Set<string>;
  current: string | null;
  readonly lines: string[] = [];
  readonly turns: Map<string, Turn>;
  readonly write: Writer;

  constructor(transcript: Transcript, style: TranscriptStyle) {
    this.closed = new Set(transcript.closed);
    this.current = transcript.current;
    this.turns = new Map(transcript.turns);
    this.write = writerFor(style);
  }

  enter(speaker: Speaker) {
    if (speaker.key !== this.current) {
      this.lines.push("", this.write.header(speaker));
      this.current = speaker.key;
    }
  }

  asUser(key: string, text: string, startedAt: number | null) {
    const { heading, indented, paint } = this.write;

    this.closeTurn(key);
    this.turns.set(key, openedTurn(this.turns.get(key), startedAt));
    this.lines.push("", heading("❯", "User", paint.blue), ...indented(text, 1));
  }

  asAgent(key: string) {
    const turn = this.turns.get(key) ?? openedTurn(undefined, null);

    if (!turn.answering) {
      const { heading, paint } = this.write;
      this.lines.push(heading("◆", "Agent", paint.magenta));
    }

    this.turns.set(key, { ...turn, answering: true });
  }

  closeTurn(key: string, failure: string | null = null) {
    const turn = this.turns.get(key);

    if (turn?.open === true) {
      const { close, nested, paint } = this.write;
      const facts = turn.replied
        ? paint.dim(turnFacts(turn))
        : paint.dim(`${turnFacts(turn)} · `) +
          (failure === null ? paint.dim("no reply") : paint.red(failure));

      this.lines.push(turn.answering ? close(facts) : nested(facts));
      this.turns.set(key, { ...turn, open: false });
    }
  }

  done() {
    return {
      lines: this.lines,
      transcript: {
        closed: this.closed,
        current: this.current,
        turns: this.turns,
      } satisfies Transcript,
    };
  }
}

export const transcribe = (
  transcript: Transcript,
  spoken: readonly Spoken[],
  style: TranscriptStyle
) => {
  const draft = new Draft(transcript, style);

  for (const { entry, speaker } of spoken) {
    draft.enter(speaker);

    if (entry._tag !== "message") {
      draft.asAgent(speaker.key);
      draft.lines.push(stepLine(entry, draft.write));
    } else if (entry.role === "user") {
      draft.asUser(speaker.key, entry.text, entry.finishedAtMillis ?? null);
    } else {
      draft.asAgent(speaker.key);
      draft.turns.set(
        speaker.key,
        repliedTurn(draft.turns.get(speaker.key), {
          costUsd: entry.usage?.costUsd ?? null,
          finishedAtMillis: entry.finishedAtMillis ?? null,
        })
      );
      draft.lines.push(...draft.write.indented(entry.text, 1));
    }
  }

  return draft.done();
};

export const settle = (
  transcript: Transcript,
  settled: readonly Settled[],
  style: TranscriptStyle
) => {
  const draft = new Draft(transcript, style);

  for (const { speaker, verdict } of settled) {
    if (!draft.closed.has(speaker.key)) {
      draft.enter(speaker);
      draft.closeTurn(speaker.key, verdict.failure ?? null);
      draft.lines.push("", ...verdictLines(verdict, draft.write));
      draft.closed.add(speaker.key);
      draft.current = null;
    }
  }

  return draft.done();
};
