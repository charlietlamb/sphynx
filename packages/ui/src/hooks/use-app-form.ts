import { MultiSelectField } from "@sphynx/ui/components/form/multi-select-field";
import { SelectField } from "@sphynx/ui/components/form/select-field";
import { SubmitButton } from "@sphynx/ui/components/form/submit-button";
import { TagsField } from "@sphynx/ui/components/form/tags-field";
import { TextField } from "@sphynx/ui/components/form/text-field";
import { createFormHook } from "@tanstack/react-form";
import { fieldContext, formContext } from "@sphynx/ui/hooks/form-context";

export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    TextField,
    SelectField,
    MultiSelectField,
    TagsField,
  },
  formComponents: {
    SubmitButton,
  },
});
