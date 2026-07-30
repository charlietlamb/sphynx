const LINK_URL = /<([^>]+)>/;

const pageFrom = (link: string | null, rel: string) => {
  const target = link
    ?.split(",")
    .find((part) => part.includes(`rel="${rel}"`))
    ?.match(LINK_URL)?.[1];
  if (!target) {
    return null;
  }
  const page = Number(new URL(target).searchParams.get("page"));
  return Number.isInteger(page) ? page : null;
};

export const nextPageFrom = (link: string | null) => pageFrom(link, "next");
export const lastPageFrom = (link: string | null) => pageFrom(link, "last");
