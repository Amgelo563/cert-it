import { TemplateFieldTypeEnum } from './TemplateFieldTypeEnum';

/** Returns whether a template prints the participant's name, without which its certificates name no one. */
export function hasParticipantNameField(template: {
  readonly schemas: readonly (readonly { readonly type: string }[])[];
}): boolean {
  return template.schemas.some((page) =>
    page.some((field) => field.type === TemplateFieldTypeEnum.ParticipantName),
  );
}
