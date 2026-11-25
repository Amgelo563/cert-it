import type { FieldMessages } from './FieldMessages';

export const EsFieldMessages = {
  courseFields: {
    manage: 'Administrar campos',
    title: 'Campos del curso',
    description:
      'Datos adicionales que puede tener cada participante, como un grupo, una nota o una foto. Puedes imprimirlos en el certificado e importarlos desde un CSV.',
    empty: 'Todavía no hay campos.',
    label: 'Nombre',
    type: 'Tipo',
    required: 'Obligatorio',
    requiredDescription:
      'Los participantes sin un valor no reciben certificado.',
    types: {
      text: 'Texto',
      number: 'Número',
      date: 'Fecha',
      boolean: 'Sí o no',
      image: 'Imagen',
    },
    add: 'Agregar campo',
    added: 'Se agregó {label}.',
    deleted: 'Se eliminó {label}.',
    moveUp: 'Subir {label}',
    moveDown: 'Bajar {label}',
    deleteOf: 'Eliminar {label}',
    deleteTitle: '¿Eliminar este campo?',
    deleteText:
      'Se eliminará {label} y los valores que tienen {count} participantes. Si la plantilla lo imprime, se guardará una nueva versión sin él y los certificados existentes aparecerán como desactualizados. Esto no se puede deshacer.',
    typeLocked:
      'Hay participantes con valores, así que el tipo no se puede cambiar.',
    valueCount: '{count} con valor',
    yes: 'Sí',
    no: 'No',
    notSet: 'Sin valor',
    missingRequired: '{label} es obligatorio',
    uploadImage: 'Subir imagen',
    replaceImage: 'Reemplazar',
    removeImage: 'Quitar',
    imageAlt: '{label}',
    imageRejected: 'Elige una imagen PNG o JPEG de hasta 2 MB.',
    datePlaceholder: 'Elige una fecha',
  },
  fieldImport: {
    newField: 'Campo nuevo',
    newFieldType: 'Tipo del campo nuevo',
    newFieldsNote: 'Los campos nuevos se agregan al curso al continuar.',
    duplicateField: 'Cada campo solo puede venir de una columna.',
    labelTaken:
      'Un campo nuevo tendría el mismo nombre que otro campo. Asigna esa columna al campo que ya existe.',
    tooManyFields:
      'Un curso admite hasta {max} campos. Marca algunas columnas como "No importar".',
    imagesTitle: 'Imágenes (opcional)',
    imagesDescription:
      'Para los campos de imagen, suelta las imágenes o un ZIP con ellas. Cada celda del CSV indica su archivo, como ana.jpg.',
    imagesReady: '{count} imágenes listas',
    imagesRejected: 'Elige imágenes PNG o JPEG, o archivos ZIP.',
    imagesUnreadable: 'No se pudo abrir un archivo ZIP.',
    uploading: 'Subiendo imágenes: {done} de {total}',
    errors: {
      required: '{field} es obligatorio',
      tooLong: '{field} tiene más de 1000 caracteres',
      invalidNumber: '{field} no es un número',
      invalidDate: '{field} no es una fecha',
      invalidBoolean: '{field} no es sí o no',
      imageNotFound:
        '{field}: no se dio ninguna imagen con ese nombre de archivo',
      imageAmbiguous: '{field}: varias imágenes tienen ese nombre de archivo',
      imageInvalid: '{field}: el archivo no es una imagen PNG o JPEG',
      imageTooLarge: '{field}: la imagen pesa más de 2 MB',
      imageNotUploaded: '{field}: no se pudo subir la imagen',
    },
    dateOrders: {
      day_first: 'Las fechas de {field} se leyeron como día/mes/año.',
      month_first: 'Las fechas de {field} se leyeron como mes/día/año.',
    },
  },
  fieldTemplate: {
    trueText: 'Texto si es sí',
    falseText: 'Texto si es no',
  },
} satisfies FieldMessages;
