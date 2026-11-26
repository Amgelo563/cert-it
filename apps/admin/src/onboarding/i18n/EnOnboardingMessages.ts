import type { OnboardingMessages } from './OnboardingMessages';

export const EnOnboardingMessages = {
  onboarding: {
    hub: {
      title: 'Getting started',
      description:
        'Short tours of the main tasks, on sample data. Nothing you do in them is saved.',
      menuItem: 'Getting started',
      progress: '{done} / {total}',
      start: 'Start',
      replay: 'Replay',
      done: 'Done',
      toDo: 'To do',
      allDone: "You've seen every task. Replay any of them from here.",
      dismiss: "Don't show again",
      failed: "Couldn't load your progress. Try again later.",
    },
    steps: {
      createCourse: {
        title: 'Create a course',
        description:
          'A course holds its participants, template and certificates',
      },
      designTemplate: {
        title: 'Design the template',
        description: 'Place the participant name on your PDF',
      },
      addParticipants: {
        title: 'Add participants',
        description: 'One by one, or from a CSV file',
      },
      issueCertificates: {
        title: 'Issue certificates',
        description: 'Make a certificate for everyone at once',
      },
      browseCourse: {
        title: 'Browse a course',
        description: 'Find participants and their certificates',
      },
      viewCertificate: {
        title: 'See what recipients get',
        description: 'A certificate, its code and its public page',
      },
      inviteUser: {
        title: 'Invite a teammate',
        description: 'Give someone else access to the panel',
      },
    },
    practice: {
      bar: 'Practice: nothing you do here is saved',
      exit: 'Exit practice',
      starting: 'Preparing the sample data',
    },
    tour: {
      next: 'Next',
      back: 'Back',
      close: 'Close',
      finish: 'Finish',
      doIt: 'Do it to continue',
      progress: '{current} / {total}',
    },
    tours: {
      createCourse: {
        list: {
          title: 'Courses',
          body: 'Each course groups the people who took it, the certificate template and the certificates issued.',
        },
        add: {
          title: 'Create a course',
          body: 'Name it as it should read on certificates, then pick their language and date format. Create one now to continue.',
        },
        tabs: {
          title: 'Inside a course',
          body: 'Participants, certificates, the template and settings each have their own tab.',
        },
      },
      designTemplate: {
        designer: {
          title: 'The template',
          body: 'Your PDF is the background. Fields placed on it are filled in for each participant when certificates are issued.',
        },
        fonts: {
          title: 'Fonts',
          body: 'Name and date fields print text, so the template needs a font. Open the fonts to continue.',
        },
        addFont: {
          title: 'Add a font',
          body: 'Pick one already stored, search the online catalog by name, or upload a TTF or OTF file. Add one to continue.',
        },
        fieldBar: {
          title: 'Add the participant name',
          body: 'Drag the participant name, the first button in the bar on the left of the editor, onto the page. Then resize it where the name should go.',
        },
        applyFont: {
          title: 'Apply a font',
          body: 'Open the field settings with this button if they are closed, then select the name on the page. Its font is picked there, among the fonts you added.',
        },
        save: {
          title: 'Save a version',
          body: 'Each save is a new version. Save once the name field is on the page to continue.',
        },
        narrow: {
          title: 'Best on a wider screen',
          body: 'The template designer needs a screen at least as wide as a laptop. Open the panel on a computer to try it.',
        },
      },
      addParticipants: {
        table: {
          title: 'Participants',
          body: 'Everyone who gets a certificate from this course, with the state of their certificate.',
        },
        import: {
          title: 'Import a CSV',
          body: 'Bring in a whole list at once. You pick which columns hold the name and email, and see what will change before saving.',
        },
        add: {
          title: 'Add a participant',
          body: 'Or add people one by one. Add someone now to continue.',
        },
      },
      issueCertificates: {
        issue: {
          title: 'Issue certificates',
          body: 'Make certificates for every participant without one. Issue them now to continue.',
        },
        table: {
          title: 'Made in the background',
          body: 'Certificates are made while you keep working, and show here with their code once they are ready.',
        },
      },
      browseCourse: {
        list: {
          title: 'Courses',
          body: 'Each course groups the people who took it and their certificates. Open one to see them.',
        },
        tabs: {
          title: 'Inside a course',
          body: 'Participants and certificates each have their own tab.',
        },
        participants: {
          title: 'Participants',
          body: 'Search by name or email, and filter by the state of their certificate.',
        },
      },
      viewCertificate: {
        table: {
          title: 'Certificates',
          body: 'Every certificate has a code. Recipients use it to open their certificate, and anyone can use it to check that it is real.',
        },
        sample: {
          title: 'What recipients get',
          body: 'A PDF with their name, the date and a QR code that leads to its public page.',
        },
      },
      inviteUser: {
        table: {
          title: 'Users',
          body: 'Everyone with access to the panel, and the role that decides what they can do.',
        },
        add: {
          title: 'Invite a teammate',
          body: 'Enter their email and pick a role. Add someone now to continue.',
        },
        password: {
          title: 'A one-time password',
          body: 'Hand it to them yourself. They must change it the first time they log in.',
        },
      },
    },
    samples: {
      courseName: 'Introduction to data analysis',
      draftCourseName: 'Public speaking workshop',
      participant1: 'Alex Morgan',
      participant2: 'Sam Rivera',
      participant3: 'Jordan Lee',
      teammateEmail: 'teammate@example.org',
      teammateName: 'Sam Rivera',
      pdfTitle: 'Certificate of completion',
      pdfIntro: 'This certifies that',
      pdfOutro: 'has completed the course',
    },
    certificate: {
      title: 'Sample certificate',
      code: 'Code',
      codeText:
        'The code is printed on the public page and inside the QR code. It opens the certificate and proves it was issued here.',
      lookupText:
        'If lookup is turned on for the course, anyone can also check a certificate by typing its code.',
    },
  },
} satisfies OnboardingMessages;
