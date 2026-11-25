import type { FieldMessages } from './FieldMessages';

export const EnFieldMessages = {
  courseFields: {
    manage: 'Manage fields',
    title: 'Course fields',
    description:
      'Extra details each participant can have, such as a group, a grade or a photo. You can print them on the certificate and import them from a CSV.',
    empty: 'No fields yet.',
    label: 'Label',
    type: 'Type',
    required: 'Required',
    requiredDescription:
      "Participants without a value don't get a certificate.",
    types: {
      text: 'Text',
      number: 'Number',
      date: 'Date',
      boolean: 'Yes or no',
      image: 'Image',
    },
    add: 'Add field',
    added: '{label} was added.',
    deleted: '{label} was deleted.',
    moveUp: 'Move {label} up',
    moveDown: 'Move {label} down',
    deleteOf: 'Delete {label}',
    deleteTitle: 'Delete this field?',
    deleteText:
      "This deletes {label} and the values {count} participants have for it. If the template prints it, a new template version is saved without it, and existing certificates show as outdated. This can't be undone.",
    typeLocked: "Participants have values, so the type can't change.",
    valueCount: '{count} with a value',
    yes: 'Yes',
    no: 'No',
    notSet: 'Not set',
    missingRequired: '{label} is required',
    uploadImage: 'Upload image',
    replaceImage: 'Replace',
    removeImage: 'Remove',
    imageAlt: '{label}',
    imageRejected: 'Choose a PNG or JPEG image of up to 2 MB.',
    datePlaceholder: 'Pick a date',
  },
  fieldImport: {
    newField: 'New field',
    newFieldType: 'Type of the new field',
    newFieldsNote: 'New fields are added to the course when you continue.',
    duplicateField: 'Each field can only come from one column.',
    labelTaken:
      'A new field would have the same label as another field. Map that column to the existing field instead.',
    tooManyFields:
      'A course takes up to {max} fields. Set some columns to "Don\'t import".',
    imagesTitle: 'Images (optional)',
    imagesDescription:
      'For image fields, drop the images or a ZIP of them. Each CSV cell names its file, such as ana.jpg.',
    imagesReady: '{count} images ready',
    imagesRejected: 'Choose PNG or JPEG images, or ZIP files.',
    imagesUnreadable: "A ZIP file couldn't be opened.",
    uploading: 'Uploading images: {done} of {total}',
    errors: {
      required: '{field} is required',
      tooLong: '{field} is over 1,000 characters',
      invalidNumber: "{field} isn't a number",
      invalidDate: "{field} isn't a date",
      invalidBoolean: "{field} isn't yes or no",
      imageNotFound: '{field}: no image with that file name was given',
      imageAmbiguous: '{field}: several images have that file name',
      imageInvalid: "{field}: the file isn't a PNG or JPEG image",
      imageTooLarge: '{field}: the image is over 2 MB',
      imageNotUploaded: "{field}: the image couldn't be uploaded",
    },
    dateOrders: {
      day_first: 'Dates in {field} were read as day/month/year.',
      month_first: 'Dates in {field} were read as month/day/year.',
    },
  },
  fieldTemplate: {
    trueText: 'Text when yes',
    falseText: 'Text when no',
  },
} satisfies FieldMessages;
