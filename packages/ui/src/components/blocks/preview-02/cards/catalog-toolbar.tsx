"use client";

import { IconPlaceholder } from "@sphynx/ui/components/blocks/preview-02/components/icon-placeholder";
import { Button } from "@sphynx/ui/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@sphynx/ui/components/ui/input-group";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@sphynx/ui/components/ui/toggle-group";

export function CatalogToolbar() {
  return (
    <div className="flex items-center gap-3">
      <InputGroup className="flex-1">
        <InputGroupAddon>
          <IconPlaceholder
            hugeicons="Search01Icon"
            lucide="SearchIcon"
            phosphor="MagnifyingGlassIcon"
            remixicon="RiSearchLine"
            tabler="IconSearch"
          />
        </InputGroupAddon>
        <InputGroupInput placeholder="Search releases or catalog..." />
      </InputGroup>
      <Button>
        <IconPlaceholder
          hugeicons="Add01Icon"
          lucide="PlusIcon"
          phosphor="PlusIcon"
          remixicon="RiAddLine"
          tabler="IconPlus"
        />
        Upload New Release
      </Button>
      <ToggleGroup defaultValue={["releases"]} variant="outline">
        <ToggleGroupItem value="all-tracks">All Tracks</ToggleGroupItem>
        <ToggleGroupItem value="releases">Releases</ToggleGroupItem>
        <ToggleGroupItem value="top-earners">Top Earners</ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
