"use client";

import { IconPlaceholder } from "@sphynx/ui/components/blocks/preview-02/components/icon-placeholder";
import { Badge } from "@sphynx/ui/components/ui/badge";
import { Card, CardContent, CardHeader } from "@sphynx/ui/components/ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@sphynx/ui/components/ui/input-group";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@sphynx/ui/components/ui/item";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@sphynx/ui/components/ui/toggle-group";

const HOLDINGS = [
  {
    ticker: "VOO",
    name: "Vanguard S&P 500 ETF",
    type: "ETF",
    added: "Jan 2021",
    shares: "112",
    value: "$48,230.40",
  },
  {
    ticker: "VIG",
    name: "Vanguard Dividend Appreciation",
    type: "ETF",
    added: "Mar 2022",
    shares: "450",
    value: "$26,033.79",
  },
  {
    ticker: "AAPL",
    name: "Apple Inc.",
    type: "Stock",
    added: "Nov 2020",
    shares: "85",
    value: "$18,488.90",
  },
  {
    ticker: "O",
    name: "Realty Income Corp",
    type: "REIT",
    added: "Jun 2023",
    shares: "320",
    value: "$15,136.59",
  },
];

export function ReleaseCatalog() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <InputGroup className="max-w-sm">
            <InputGroupAddon>
              <IconPlaceholder
                hugeicons="Search01Icon"
                lucide="SearchIcon"
                phosphor="MagnifyingGlassIcon"
                remixicon="RiSearchLine"
                tabler="IconSearch"
              />
            </InputGroupAddon>
            <InputGroupInput placeholder="Search holdings or tickers..." />
          </InputGroup>
          <ToggleGroup defaultValue={["etfs"]} spacing={1} variant="outline">
            <ToggleGroupItem value="stocks">Stocks</ToggleGroupItem>
            <ToggleGroupItem value="etfs">ETFs</ToggleGroupItem>
            <ToggleGroupItem value="reits">REITs</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </CardHeader>
      <CardContent>
        <ItemGroup>
          {HOLDINGS.map((holding) => (
            <Item key={holding.ticker} variant="muted">
              <ItemMedia>
                <div className="flex size-12 items-center justify-center rounded-lg border font-semibold text-sm">
                  {holding.ticker}
                </div>
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{holding.name}</ItemTitle>
                <ItemDescription className="text-xs uppercase tracking-wider">
                  {holding.shares} Shares · {holding.added}
                </ItemDescription>
              </ItemContent>
              <div className="flex shrink-0 items-center gap-6">
                <Badge variant="outline">{holding.type}</Badge>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">
                    Value
                  </span>
                  <span className="font-medium tabular-nums">
                    {holding.value}
                  </span>
                </div>
              </div>
            </Item>
          ))}
        </ItemGroup>
      </CardContent>
    </Card>
  );
}
