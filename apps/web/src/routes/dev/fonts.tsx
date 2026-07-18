import "@fontsource-variable/fraunces";
import "@fontsource/instrument-serif";
import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/schibsted-grotesk";
import "@fontsource-variable/dm-sans";
import "@fontsource/dm-serif-display";
import "@fontsource/gloock";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/sora";
import "@fontsource-variable/funnel-display";
import "@fontsource-variable/newsreader";
import "@fontsource-variable/manrope";
import "@fontsource-variable/playfair-display";
import "@fontsource/young-serif";
import "@fontsource-variable/cormorant";
import "@fontsource-variable/source-serif-4";
import "@fontsource-variable/inter";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/outfit";
import "@fontsource-variable/gabarito";
import "@fontsource-variable/hanken-grotesk";
import "@fontsource-variable/familjen-grotesk";
import "@fontsource-variable/syne";
import "@fontsource-variable/red-hat-display";
import "@fontsource-variable/archivo";
import "@fontsource-variable/unbounded";
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
  {
    name: "DM Serif Display",
    note: "sharp display serif, single weight",
    stack: '"DM Serif Display", ui-serif, Georgia, serif',
  },
  {
    name: "Gloock",
    note: "high-contrast modern serif, single weight",
    stack: '"Gloock", ui-serif, Georgia, serif',
  },
  {
    name: "Newsreader",
    note: "elegant editorial serif",
    stack: '"Newsreader Variable", ui-serif, Georgia, serif',
  },
  {
    name: "Bricolage Grotesque",
    note: "characterful grotesque",
    stack: '"Bricolage Grotesque Variable", ui-sans-serif, sans-serif',
  },
  {
    name: "DM Sans",
    note: "clean geometric sans",
    stack: '"DM Sans Variable", ui-sans-serif, sans-serif',
  },
  {
    name: "Sora",
    note: "geometric, techy",
    stack: '"Sora Variable", ui-sans-serif, sans-serif',
  },
  {
    name: "Funnel Display",
    note: "narrow display sans",
    stack: '"Funnel Display Variable", ui-sans-serif, sans-serif',
  },
  {
    name: "Manrope",
    note: "neutral modern sans",
    stack: '"Manrope Variable", ui-sans-serif, sans-serif',
  },
  {
    name: "Playfair Display",
    note: "classic high-contrast serif",
    stack: '"Playfair Display Variable", ui-serif, Georgia, serif',
  },
  {
    name: "Young Serif",
    note: "chunky warm serif, single weight",
    stack: '"Young Serif", ui-serif, Georgia, serif',
  },
  {
    name: "Cormorant",
    note: "light elegant serif",
    stack: '"Cormorant Variable", ui-serif, Georgia, serif',
  },
  {
    name: "Source Serif 4",
    note: "sturdy editorial serif",
    stack: '"Source Serif 4 Variable", ui-serif, Georgia, serif',
  },
  {
    name: "Inter",
    note: "the default everyone knows",
    stack: '"Inter Variable", ui-sans-serif, sans-serif',
  },
  {
    name: "Plus Jakarta Sans",
    note: "rounded geometric sans",
    stack: '"Plus Jakarta Sans Variable", ui-sans-serif, sans-serif',
  },
  {
    name: "Outfit",
    note: "clean geometric display",
    stack: '"Outfit Variable", ui-sans-serif, sans-serif',
  },
  {
    name: "Gabarito",
    note: "friendly geometric sans",
    stack: '"Gabarito Variable", ui-sans-serif, sans-serif',
  },
  {
    name: "Hanken Grotesk",
    note: "quiet modern grotesque",
    stack: '"Hanken Grotesk Variable", ui-sans-serif, sans-serif',
  },
  {
    name: "Familjen Grotesk",
    note: "compact swedish grotesque",
    stack: '"Familjen Grotesk Variable", ui-sans-serif, sans-serif',
  },
  {
    name: "Syne",
    note: "wide arty display",
    stack: '"Syne Variable", ui-sans-serif, sans-serif',
  },
  {
    name: "Red Hat Display",
    note: "geometric display sans",
    stack: '"Red Hat Display Variable", ui-sans-serif, sans-serif',
  },
  {
    name: "Archivo",
    note: "grotesque workhorse",
    stack: '"Archivo Variable", ui-sans-serif, sans-serif',
  },
  {
    name: "Unbounded",
    note: "wide techy display",
    stack: '"Unbounded Variable", ui-sans-serif, sans-serif',
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
