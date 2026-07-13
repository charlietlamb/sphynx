import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@sphynx/ui/components/ui/card";

export function IndexInvesting() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dollar-Cost Averaging</CardTitle>
        <CardDescription>
          A strategy for building wealth over time.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CardDescription className="mt-3 style-sera:mt-0 text-sm leading-relaxed">
          <a
            className="underline underline-offset-4 hover:text-primary"
            href="#"
          >
            Over time
          </a>
          , this smooths out the average cost of your investments. When prices
          drop, your fixed amount buys more shares. When prices rise, you buy
          fewer. The result is a lower average cost per share compared to
          lump-sum investing during volatile periods.
        </CardDescription>
      </CardContent>
    </Card>
  );
}
