import { PullRequestRefSchema } from "@sphynx/schema/pull-requests";
import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import { PullRequestPage } from "@/components/pull-request/pull-request-page";
import { PullRequestUrlError } from "@/components/pull-request/pull-request-url-error";

const parseRef = Schema.decodeUnknownSync(PullRequestRefSchema);

export const Route = createFileRoute("/$owner/$repo/pull/$number")({
  params: {
    parse: parseRef,
    stringify: (ref) => ({
      owner: ref.owner,
      repo: ref.repo,
      number: String(ref.number),
    }),
  },
  validateSearch: (search) => search,
  head: ({ params }) => ({
    meta: [{ title: `${params.owner}/${params.repo} #${params.number}` }],
  }),
  component: PullRequestRoute,
  errorComponent: PullRequestUrlError,
});

function PullRequestRoute() {
  const ref = Route.useParams();
  return <PullRequestPage pullRequestRef={ref} />;
}
