import { Link } from "@tanstack/react-router";
import { GithubIcon } from "@/components/icons/github-icon";
import { TwitterIcon } from "@/components/icons/twitter-icon";
import { SocialLink } from "@/components/layout/social-link";
import { SphynxMark } from "@/components/layout/sphynx-mark";

export function SiteHeader() {
  return (
    <header className="relative z-10 flex items-center justify-between py-4 pr-2 pl-4 sm:pr-4 sm:pl-6">
      <Link className="flex items-center gap-1.5" to="/">
        <SphynxMark />
        <span className="font-heading text-xl tracking-tight">Sphynx</span>
      </Link>
      <nav className="flex items-center gap-1">
        <SocialLink
          href="https://github.com/charlietlamb/sphynx"
          label="GitHub"
        >
          <GithubIcon />
        </SocialLink>
        <SocialLink href="https://x.com/charlietlamb" label="X">
          <TwitterIcon />
        </SocialLink>
      </nav>
    </header>
  );
}
