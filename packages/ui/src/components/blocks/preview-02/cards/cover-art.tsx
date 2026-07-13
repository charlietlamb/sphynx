import { IconPlaceholder } from "@sphynx/ui/components/blocks/preview-02/components/icon-placeholder";
import { Button } from "@sphynx/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
} from "@sphynx/ui/components/ui/card";
import { Item } from "@sphynx/ui/components/ui/item";
import { Label } from "@sphynx/ui/components/ui/label";

export function CoverArt() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <Label
          className="text-center font-normal text-muted-foreground text-xs uppercase tracking-wider"
          htmlFor="cover-art"
        >
          Cover Art
        </Label>
        <Item className="aspect-square" variant="outline">
          <label
            className="flex size-full cursor-pointer items-center justify-center"
            htmlFor="cover-art"
          >
            <IconPlaceholder
              className="size-10 text-muted-foreground/50"
              hugeicons="Image01Icon"
              lucide="ImageIcon"
              phosphor="ImageIcon"
              remixicon="RiImageLine"
              tabler="IconPhoto"
            />
          </label>
        </Item>
        <input
          accept="image/jpeg,image/png"
          className="sr-only"
          id="cover-art"
          type="file"
        />
      </CardContent>
      <CardFooter className="flex-col gap-2">
        <Button
          className="w-full"
          nativeButton={false}
          render={<label className="cursor-pointer" htmlFor="cover-art" />}
          variant="secondary"
        >
          Upload Artwork
        </Button>
        <CardDescription className="text-center text-xs">
          Minimum 3000 × 3000px
          <br />
          JPEG or PNG only
        </CardDescription>
      </CardFooter>
    </Card>
  );
}
