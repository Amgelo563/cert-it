import { access } from 'node:fs/promises';
import {
  ApiErrorCodeEnum,
  CourseFieldTypeEnum,
  type FieldValues,
  type FieldValuesInput,
  isFieldValueOf,
  isImageFileName,
} from '@cert-it/shared';
import { Result } from 'better-result';
import type { CourseId } from '../course/Course';
import type { DataDirectoryService } from '../storage/DataDirectoryService';
import { type CourseField, listMissingRequired } from './CourseField';

type FieldValueMergerOptions = {
  dataDirectory: DataDirectoryService;
};

/** A participant's values with the given ones applied, and the fields whose value changed. */
export type MergedFieldValues = {
  readonly values: FieldValues;
  readonly changed: readonly CourseField[];
};

/** Why given values can't be applied. */
export type FieldValueMergeError =
  | typeof ApiErrorCodeEnum.UnknownField
  | typeof ApiErrorCodeEnum.InvalidFieldValue
  | typeof ApiErrorCodeEnum.FieldRequired;

/** Applies values given by hand to a participant's, checking each against its field. */
export class FieldValueMerger {
  protected readonly dataDirectory: DataDirectoryService;

  constructor(options: FieldValueMergerOptions) {
    this.dataDirectory = options.dataDirectory;
  }

  /**
   * Returns the participant's values with the given ones set, and null ones cleared.
   *
   * Every value must fit its field's type, images must be stored in the course, and the result must keep the required fields set.
   */
  public async merge(options: {
    courseId: CourseId;
    fields: readonly CourseField[];
    current: FieldValues;
    input: FieldValuesInput;
  }): Promise<Result<MergedFieldValues, FieldValueMergeError>> {
    const { courseId, fields, current, input } = options;
    const byId = new Map(fields.map((field) => [String(field.id), field]));
    // values of fields deleted meanwhile go
    const values: Record<string, FieldValues[string]> = Object.fromEntries(
      Object.entries(current).filter(([id]) => byId.has(id)),
    );
    const changed: CourseField[] = [];

    for (const [id, given] of Object.entries(input)) {
      const field = byId.get(id);
      if (!field) return Result.err(ApiErrorCodeEnum.UnknownField);

      const value = typeof given === 'string' ? given.trim() : given;
      if (value === null || value === '') {
        if (values[id] !== undefined) changed.push(field);
        delete values[id];
        continue;
      }
      if (!isFieldValueOf(field.type, value)) {
        return Result.err(ApiErrorCodeEnum.InvalidFieldValue);
      }
      if (
        field.type === CourseFieldTypeEnum.Image
        && !(await this.isStored(courseId, String(value)))
      ) {
        return Result.err(ApiErrorCodeEnum.InvalidFieldValue);
      }
      if (values[id] !== value) changed.push(field);
      values[id] = value;
    }

    if (listMissingRequired(fields, values).length > 0) {
      return Result.err(ApiErrorCodeEnum.FieldRequired);
    }
    return Result.ok({ values, changed });
  }

  /** Returns the given image file names that aren't stored in the course. */
  public async listMissingImages(
    courseId: CourseId,
    fileNames: readonly string[],
  ): Promise<Set<string>> {
    const missing = new Set<string>();
    for (const fileName of fileNames) {
      if (!(await this.isStored(courseId, fileName))) missing.add(fileName);
    }
    return missing;
  }

  protected async isStored(
    courseId: CourseId,
    fileName: string,
  ): Promise<boolean> {
    // a name that isn't an image file name can't be stored
    if (!isImageFileName(fileName)) return false;
    try {
      await access(
        this.dataDirectory.resolve(
          this.dataDirectory.getImageFile(courseId, fileName),
        ),
      );
      return true;
    } catch {
      return false;
    }
  }
}
