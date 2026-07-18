import "@fontsource-variable/fraunces";
import "@fontsource/instrument-serif";
import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/schibsted-grotesk";
import { createFileRoute, notFound } from "@tanstack/react-router";

const CANDIDATES = [
  {
    name: "Fraunces (current)",
    note: "warm editorial serif",
    stack: '"Fraunces Variable", ui-serif, Georgia, serif',
  },
  {
    name: "Instrument Serif",
    note: "sharp high-contrast serif, single weight",
    stack: '"Instrument Serif", ui-serif, Georgia, serif',
  },
  {
    name: "Instrument Sans",
    note: "clean grotesque with a little quirk",
    stack: '"Instrument Sans Variable", ui-sans-serif, sans-serif',
  },
  {
    name: "Schibsted Grotesk",
    note: "sharp editorial grotesque",
    stack: '"Schibsted Grotesk Variable", ui-sans-serif, sans-serif',
  },
  {
    name: "Space Grotesk",
    note: "techy, echoes the mono",
    stack: '"Space Grotesk Variable", ui-sans-serif, sans-serif',
  },
  {
    name: "Geist",
    note: "same as body, monobrand",
    stack: '"Geist Variable", ui-sans-serif, sans-serif',
  },
];

function FontGallery() {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-[11px] text-muted-foreground/60">
          Heading font candidates · hero, pull request title, dossier title
        </p>
        {CANDIDATES.map((candidate) => (
          <section
            className="mt-8 border border-border p-8"
            key={candidate.name}
          >
            <div className="flex items-baseline justify-between gap-4">
              <p className="font-medium text-[11px] text-muted-foreground">
                {candidate.name}
              </p>
              <p className="text-[11px] text-muted-foreground/60">
                {candidate.note}
              </p>
            </div>
            <p
              className="mt-6 text-5xl tracking-tight"
              style={{ fontFamily: candidate.stack }}
            >
              Unfuck code review.
            </p>
            <p
              className="mt-6 text-2xl tracking-tight"
              style={{ fontFamily: candidate.stack }}
            >
              fix(billing): honor phase anchor resets in schedule previews
            </p>
            <p
              className="mt-4 text-xl tracking-tight"
              style={{ fontFamily: candidate.stack }}
            >
              Add pooled plan item balances
            </p>
          </section>
        ))}
      </div>
    </main>
  );
}

export const Route = createFileRoute("/dev/fonts")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) {
      throw notFound();
    }
  },
  component: FontGallery,
});
