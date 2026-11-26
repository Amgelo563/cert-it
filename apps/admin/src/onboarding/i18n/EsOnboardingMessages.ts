import type { OnboardingMessages } from './OnboardingMessages';

export const EsOnboardingMessages = {
  onboarding: {
    hub: {
      title: 'Primeros pasos',
      description:
        'Recorridos cortos por las tareas principales, con datos de ejemplo. Nada de lo que hagas en ellos se guarda.',
      menuItem: 'Primeros pasos',
      progress: '{done} / {total}',
      start: 'Empezar',
      replay: 'Repetir',
      done: 'Hecho',
      toDo: 'Pendiente',
      allDone:
        'Ya viste todas las tareas. Puedes repetir cualquiera desde aquí.',
      dismiss: 'No volver a mostrar',
      failed: 'No se pudo cargar tu avance. Inténtalo más tarde.',
    },
    steps: {
      createCourse: {
        title: 'Crear un curso',
        description:
          'Un curso reúne a sus participantes, su plantilla y sus certificados',
      },
      designTemplate: {
        title: 'Diseñar la plantilla',
        description: 'Coloca el nombre del participante sobre tu PDF',
      },
      manageFields: {
        title: 'Agregar campos propios',
        description: 'Datos extra de cada participante, como una nota',
      },
      addParticipants: {
        title: 'Agregar participantes',
        description: 'Uno por uno o desde un archivo CSV',
      },
      issueCertificates: {
        title: 'Emitir certificados',
        description: 'Genera un certificado para todos a la vez',
      },
      browseCourse: {
        title: 'Recorrer un curso',
        description: 'Encuentra participantes y sus certificados',
      },
      viewCertificate: {
        title: 'Ver lo que reciben',
        description: 'Un certificado, su código y su página pública',
      },
      inviteUser: {
        title: 'Invitar a alguien del equipo',
        description: 'Da acceso al panel a otra persona',
      },
    },
    practice: {
      bar: 'Práctica: nada de lo que hagas aquí se guarda',
      exit: 'Salir de la práctica',
      starting: 'Preparando los datos de ejemplo',
    },
    tour: {
      next: 'Siguiente',
      back: 'Atrás',
      close: 'Cerrar',
      finish: 'Terminar',
      doIt: 'Hazlo para continuar',
      progress: '{current} / {total}',
    },
    tours: {
      createCourse: {
        list: {
          title: 'Cursos',
          body: 'Cada curso reúne a quienes lo tomaron, la plantilla del certificado y los certificados emitidos.',
        },
        add: {
          title: 'Crear un curso',
          body: 'Ponle el nombre tal como debe aparecer en los certificados y elige su idioma y formato de fecha. Crea uno ahora para continuar.',
        },
        tabs: {
          title: 'Dentro de un curso',
          body: 'Participantes, certificados, plantilla y configuración tienen cada uno su pestaña.',
        },
      },
      designTemplate: {
        designer: {
          title: 'La plantilla',
          body: 'Tu PDF es el fondo. Los campos que colocas encima se completan para cada participante al emitir los certificados.',
        },
        fonts: {
          title: 'Fuentes',
          body: 'Los campos de nombre y fecha imprimen texto, así que la plantilla necesita una fuente. Abre las fuentes para continuar.',
        },
        addFont: {
          title: 'Agrega una fuente',
          body: 'Elige una ya guardada, busca por nombre en el catálogo en línea o sube un archivo TTF u OTF. Agrega una para continuar.',
        },
        fieldBar: {
          title: 'Agrega el nombre del participante',
          body: 'Arrastra el nombre del participante, el primer botón de la barra a la izquierda del editor, hasta la página. Luego ajústalo donde debe ir el nombre.',
        },
        applyFont: {
          title: 'Aplica una fuente',
          body: 'Abre la configuración de campos con este botón si está cerrada y selecciona el nombre en la página. Su fuente se elige ahí, entre las que agregaste.',
        },
        save: {
          title: 'Guarda una versión',
          body: 'Cada vez que guardas se crea una versión nueva. Guarda cuando el campo de nombre esté en la página para continuar.',
        },
        narrow: {
          title: 'Mejor en una pantalla más ancha',
          body: 'El diseñador de plantillas necesita una pantalla al menos tan ancha como la de una laptop. Abre el panel en una computadora para probarlo.',
        },
      },
      manageFields: {
        open: {
          title: 'Campos propios',
          body: 'Además del nombre y el correo, un curso puede guardar datos extra de cada participante, como un grupo, una nota o una foto. Abre los campos para continuar.',
        },
        add: {
          title: 'Agregar un campo',
          body: 'Ponle un nombre y elige qué guarda: texto, un número, una fecha, sí o no, o una imagen. Agrega uno ahora para continuar.',
        },
        options: {
          title: 'Cámbialo después',
          body: 'Aquí puedes renombrar, reordenar o eliminar campos. Marca uno como obligatorio para emitir certificados solo a quienes tengan un valor. El tipo ya no cambia cuando alguien tiene un valor. Cierra los campos para continuar.',
        },
        use: {
          title: 'Dónde aparecen',
          body: 'Cada campo tiene su columna aquí. Se llena al agregar un participante o desde una columna del CSV, y se coloca en la plantilla desde la barra del editor para imprimirlo en los certificados.',
        },
      },
      addParticipants: {
        table: {
          title: 'Participantes',
          body: 'Todas las personas que reciben un certificado de este curso, con el estado de su certificado.',
        },
        import: {
          title: 'Importar un CSV',
          body: 'Trae una lista completa de una vez. Eliges qué columnas tienen el nombre y el correo, y ves qué cambiará antes de guardar.',
        },
        add: {
          title: 'Agregar un participante',
          body: 'O agrega personas una por una. Agrega a alguien ahora para continuar.',
        },
      },
      issueCertificates: {
        issue: {
          title: 'Emitir certificados',
          body: 'Genera certificados para todos los participantes que aún no tienen uno. Emítelos ahora para continuar.',
        },
        table: {
          title: 'Se generan en segundo plano',
          body: 'Los certificados se generan mientras sigues trabajando y aparecen aquí con su código cuando están listos.',
        },
      },
      browseCourse: {
        list: {
          title: 'Cursos',
          body: 'Cada curso reúne a quienes lo tomaron y sus certificados. Abre uno para verlos.',
        },
        tabs: {
          title: 'Dentro de un curso',
          body: 'Participantes y certificados tienen cada uno su pestaña.',
        },
        participants: {
          title: 'Participantes',
          body: 'Busca por nombre o correo y filtra por el estado de su certificado.',
        },
      },
      viewCertificate: {
        table: {
          title: 'Certificados',
          body: 'Cada certificado tiene un código. Quien lo recibe lo usa para abrir su certificado, y cualquiera puede usarlo para comprobar que es auténtico.',
        },
        sample: {
          title: 'Lo que reciben',
          body: 'Un PDF con su nombre, la fecha y un código QR que lleva a su página pública.',
        },
      },
      inviteUser: {
        table: {
          title: 'Usuarios',
          body: 'Todas las personas con acceso al panel y el rol que define lo que pueden hacer.',
        },
        add: {
          title: 'Invitar a alguien del equipo',
          body: 'Escribe su correo y elige un rol. Agrega a alguien ahora para continuar.',
        },
        password: {
          title: 'Una contraseña de un solo uso',
          body: 'Entrégasela tú. Deberá cambiarla la primera vez que inicie sesión.',
        },
      },
    },
    samples: {
      courseName: 'Introducción al análisis de datos',
      draftCourseName: 'Taller de oratoria',
      participant1: 'Lucía Fernández',
      participant2: 'Mateo Rojas',
      participant3: 'Valeria Castro',
      teammateEmail: 'equipo@example.org',
      teammateName: 'Sofía Ramos',
      pdfTitle: 'Certificado de finalización',
      pdfIntro: 'Se certifica que',
      pdfOutro: 'ha completado el curso',
    },
    certificate: {
      title: 'Certificado de ejemplo',
      code: 'Código',
      codeText:
        'El código aparece en la página pública y dentro del código QR. Abre el certificado y demuestra que se emitió aquí.',
      lookupText:
        'Si la búsqueda está activada en el curso, cualquiera puede comprobar un certificado escribiendo su código.',
    },
  },
} satisfies OnboardingMessages;
