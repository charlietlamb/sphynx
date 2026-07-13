import { Hero } from "@/components/landing/hero";
import { SphynxBackdrop } from "@/components/landing/sphynx-backdrop";
import { SiteLayout } from "@/components/layout/site-layout";

export function Landing() {
  return (
    <SiteLayout backdrop={<SphynxBackdrop />}>
      <Hero />
    </SiteLayout>
  );
}
