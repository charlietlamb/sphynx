import { IconPlaceholder } from "@sphynx/ui/components/blocks/preview-02/components/icon-placeholder";
import { Button } from "@sphynx/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@sphynx/ui/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@sphynx/ui/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@sphynx/ui/components/ui/input-group";

export function SocialLinks() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Social Links</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="spotify-url">Spotify Artist URL</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <IconPlaceholder
                  hugeicons="PlusSignCircleIcon"
                  lucide="CirclePlusIcon"
                  phosphor="PlusCircleIcon"
                  remixicon="RiAddCircleLine"
                  tabler="IconCirclePlus"
                />
              </InputGroupAddon>
              <InputGroupInput
                defaultValue="spotify.com/artist/3j...2k"
                id="spotify-url"
              />
            </InputGroup>
          </Field>
          <Field>
            <FieldLabel htmlFor="instagram-handle">Instagram Handle</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <IconPlaceholder
                  hugeicons="Camera01Icon"
                  lucide="CameraIcon"
                  phosphor="CameraIcon"
                  remixicon="RiCameraLine"
                  tabler="IconCamera"
                />
              </InputGroupAddon>
              <InputGroupInput
                defaultValue="@julianduryea_music"
                id="instagram-handle"
              />
            </InputGroup>
          </Field>
          <Field>
            <FieldLabel htmlFor="soundcloud-url">SoundCloud URL</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <IconPlaceholder
                  hugeicons="CloudUploadIcon"
                  lucide="CloudIcon"
                  phosphor="CloudIcon"
                  remixicon="RiCloudLine"
                  tabler="IconCloud"
                />
              </InputGroupAddon>
              <InputGroupInput
                id="soundcloud-url"
                placeholder="soundcloud.com/username"
              />
            </InputGroup>
          </Field>
          <Field>
            <FieldLabel htmlFor="website-url">Website</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <IconPlaceholder
                  hugeicons="Globe02Icon"
                  lucide="GlobeIcon"
                  phosphor="GlobeIcon"
                  remixicon="RiGlobalLine"
                  tabler="IconWorld"
                />
              </InputGroupAddon>
              <InputGroupInput
                id="website-url"
                placeholder="https://yoursite.com"
              />
            </InputGroup>
          </Field>
        </FieldGroup>
      </CardContent>
      <CardFooter className="justify-end style-sera:justify-center gap-2">
        <Button className="style-sera:flex-1" variant="secondary">
          Discard
        </Button>
        <Button className="style-sera:flex-1">Save Changes</Button>
      </CardFooter>
    </Card>
  );
}
