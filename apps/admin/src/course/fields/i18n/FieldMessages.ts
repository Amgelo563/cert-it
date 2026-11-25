import type {
  CourseFieldType,
  FieldDateOrder,
  FieldValueErrorEnum,
} from '@cert-it/shared';

/** Texts of a course's fields and their values. Placeholders are written as {key}. */
export type FieldMessages = {
  courseFields: {
    /** Menu item on the participants tab. */
    manage: string;
    title: string;
    description: string;
    empty: string;
    label: string;
    type: string;
    required: string;
    requiredDescription: string;
    /** What each type holds, keyed by CourseFieldTypeEnum value. */
    types: Record<CourseFieldType, string>;
    add: string;
    /** With the field's {label}. */
    added: string;
    deleted: string;
    /** Accessible labels of a row's buttons, with the field's {label}. */
    moveUp: string;
    moveDown: string;
    deleteOf: string;
    deleteTitle: string;
    /** With the field's {label} and the participants with a value in {count}. */
    deleteText: string;
    /** Why the type can't change. */
    typeLocked: string;
    /** With the participants with a value in {count}. */
    valueCount: string;
    yes: string;
    no: string;
    notSet: string;
    /** In a participant's row, with the field's {label}. */
    missingRequired: string;
    uploadImage: string;
    replaceImage: string;
    removeImage: string;
    /** With the field's {label}. */
    imageAlt: string;
    imageRejected: string;
    datePlaceholder: string;
  };
  fieldImport: {
    /** Role of a column that becomes a new field. */
    newField: string;
    newFieldType: string;
    newFieldsNote: string;
    duplicateField: string;
    labelTaken: string;
    /** With the most fields in {max}. */
    tooManyFields: string;
    imagesTitle: string;
    imagesDescription: string;
    /** With the images ready in {count}. */
    imagesReady: string;
    imagesRejected: string;
    imagesUnreadable: string;
    /** While uploading, with {done} of {total}. */
    uploading: string;
    /** What's wrong with a cell, keyed by FieldValueErrorEnum member names, with the field's {field} label. */
    errors: Record<Uncapitalize<keyof typeof FieldValueErrorEnum>, string>;
    /** How a column's numeric dates were read, keyed by FieldDateOrderEnum value, with the field's {field} label. */
    dateOrders: Record<FieldDateOrder, string>;
  };
  fieldTemplate: {
    /** Text a boolean field prints when true. */
    trueText: string;
    falseText: string;
  };
};
