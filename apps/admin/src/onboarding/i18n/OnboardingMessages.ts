/** Title and text of one step of a tour. */
type TourStepMessages = { title: string; body: string };

/** Texts of the getting started guide, its tours and practice. Placeholders are written as `{key}`. */
export type OnboardingMessages = {
  onboarding: {
    hub: {
      title: string;
      description: string;
      /** Item of the account menu that opens the guide. */
      menuItem: string;
      /** Steps done in `{done}` out of `{total}`. */
      progress: string;
      start: string;
      replay: string;
      done: string;
      toDo: string;
      allDone: string;
      dismiss: string;
      failed: string;
    };
    /** Name and one-line description of each step, by its member name in OnboardingStepEnum. */
    steps: Record<
      | 'createCourse'
      | 'designTemplate'
      | 'manageFields'
      | 'addParticipants'
      | 'issueCertificates'
      | 'browseCourse'
      | 'viewCertificate'
      | 'inviteUser',
      { title: string; description: string }
    >;
    practice: {
      bar: string;
      exit: string;
      starting: string;
    };
    tour: {
      next: string;
      back: string;
      close: string;
      finish: string;
      /** Shown on steps that wait for the user to act. */
      doIt: string;
      /** The step's `{current}` number out of `{total}`. */
      progress: string;
    };
    tours: {
      createCourse: Record<'list' | 'add' | 'tabs', TourStepMessages>;
      designTemplate: Record<
        | 'designer'
        | 'fonts'
        | 'addFont'
        | 'fieldBar'
        | 'applyFont'
        | 'save'
        | 'narrow',
        TourStepMessages
      >;
      manageFields: Record<
        'open' | 'add' | 'options' | 'use',
        TourStepMessages
      >;
      addParticipants: Record<'table' | 'import' | 'add', TourStepMessages>;
      issueCertificates: Record<'issue' | 'table', TourStepMessages>;
      browseCourse: Record<'list' | 'tabs' | 'participants', TourStepMessages>;
      viewCertificate: Record<'table' | 'sample', TourStepMessages>;
      inviteUser: Record<'table' | 'add' | 'password', TourStepMessages>;
    };
    samples: {
      courseName: string;
      draftCourseName: string;
      participant1: string;
      participant2: string;
      participant3: string;
      teammateEmail: string;
      teammateName: string;
      pdfTitle: string;
      pdfIntro: string;
      pdfOutro: string;
    };
    certificate: {
      title: string;
      code: string;
      codeText: string;
      lookupText: string;
    };
  };
};
