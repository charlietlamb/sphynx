import { buttonVariants } from "@sphynx/ui/components/ui/button";
import { cn } from "@sphynx/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { ArrowRightIcon } from "@/components/icons/arrow-right-icon";

export function Hero() {
  return (
    <div className="flex flex-1 flex-col justify-center px-4 pb-24 sm:px-6">
      <div className="max-w-xl">
        <h1 className="fade-in-0 slide-in-from-bottom-2 animate-in text-balance fill-mode-both font-heading text-5xl tracking-tight duration-500 ease-out sm:text-6xl">
          Unfuck code review.
        </h1>
        <p className="fade-in-0 slide-in-from-bottom-2 mt-5 max-w-lg animate-in text-balance fill-mode-both text-muted-foreground delay-75 duration-500 ease-out sm:text-lg">
          A highly opinionated way to manage and review pull requests in the
          agentic era. Highly performant and open source.
        </p>
        <div className="fade-in-0 slide-in-from-bottom-2 mt-8 flex animate-in items-center gap-3 fill-mode-both delay-150 duration-500 ease-out">
          <Link
            className={cn(
              buttonVariants({ size: "lg" }),
              "btn-primary-glow h-10 px-8 text-sm"
            )}
            to="/login"
          >
            Get started
            <ArrowRightIcon />
          </Link>
        </div>
      </div>
    </div>
  );
}
