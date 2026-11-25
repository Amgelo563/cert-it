import {
  type CourseFieldSummary,
  CourseFieldTypeEnum,
  type FieldValues,
  type Locale,
  type TemplateFieldValue,
  type TemplateFieldValues,
  toTemplateFieldValues,
} from '@cert-it/shared';
import { ImagePlaceholder } from '../designer/createFieldPlugins';

type PreviewFieldValuesOptions = {
  locale: Locale;
  dateFormat: string;
  /** The participant's images as data: URLs, by stored file name. */
  images: ReadonlyMap<string, string>;
  /** What a field without a value shows instead. */
  sample: (field: CourseFieldSummary) => string;
};

/** Returns what a preview prints for each course field: the participant's value, or a placeholder of its type so the layout can be checked. */
export function previewFieldValues(
  fields: readonly CourseFieldSummary[],
  values: FieldValues,
  options: PreviewFieldValuesOptions,
): TemplateFieldValues {
  const printed = toTemplateFieldValues(fields, values, {
    locale: options.locale,
    dateFormat: options.dateFormat,
    imageUrl: (fileName) => options.images.get(fileName),
  });

  return Object.fromEntries(
    fields.map((field) => {
      const id = String(field.id);
      return [id, printed[id] ?? placeholderOf(field, options.sample)] as const;
    }),
  );
}

function placeholderOf(
  field: CourseFieldSummary,
  sample: (field: CourseFieldSummary) => string,
): TemplateFieldValue {
  if (field.type === CourseFieldTypeEnum.Image) {
    return { kind: 'image', dataUrl: ImagePlaceholder };
  }
  // the wording for yes, which is what editors place it for
  if (field.type === CourseFieldTypeEnum.Boolean) {
    return { kind: 'boolean', value: true };
  }
  return { kind: 'text', text: sample(field) };
}

/**
 * Loads a course's field images as data: URLs, as pdfme draws them.
 *
 * @returns The URLs by file name, leaving out images that can't be loaded.
 */
export async function loadFieldImages(
  urls: ReadonlyMap<string, string>,
): Promise<Map<string, string>> {
  const loaded = new Map<string, string>();
  for (const [fileName, url] of urls) {
    try {
      const response = await fetch(url, { credentials: 'same-origin' });
      if (!response.ok) continue;
      loaded.set(fileName, await toDataUrl(await response.blob()));
    } catch {
      // a missing image prints as nothing, as on the server
    }
  }
  return loaded;
}

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
