import { buttonVariants } from "@sphynx/ui/components/ui/button";
import { cn } from "@sphynx/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { ArrowRightIcon } from "@/components/icons/arrow-right-icon";

export function Hero() {
  return (
    <div className="flex flex-1 flex-col justify-center px-4 pb-24 sm:px-6">
      <div className="fade-in-0 slide-in-from-bottom-2 max-w-xl animate-in duration-700 ease-out">
        <h1 className="text-balance font-heading text-5xl tracking-tight sm:text-6xl">
          Unfuck your codebase.
        </h1>
        <p className="mt-5 max-w-lg text-balance text-muted-foreground sm:text-lg">
          Connect your repositories, understand every pull request, and help
          your team ship better code with confidence.
        </p>
        <div className="mt-8 flex items-center gap-3">
          <Link
            className={cn(buttonVariants({ size: "lg" }), "h-10 px-8 text-sm")}
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
