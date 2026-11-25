import { type OnboardingStep, OnboardingStepEnum } from '@cert-it/shared';
import { AdminPathEnum } from '../../app/router/AdminPathEnum';
import { CourseTabEnum, coursePath } from '../../course/CourseTabEnum';
import { PracticeEventEnum } from '../practice/PracticeEventEnum';
import { PdfmeTourTargets } from './PdfmeTourTargets';
import type { TourStep } from './TourStep';
import { TourTargetEnum, tourSelector } from './TourTargetEnum';

/** What tours need from the panel to be built. */
export type TourContext = {
  /** The practice course with participants and a full template. */
  sampleCourseId: number;
  /** The practice course whose template lacks the participant name. */
  draftCourseId: number;
  /** Whether the screen is too narrow for the template designer. */
  narrow: boolean;
  openSampleCertificate: () => void;
};

/** Returns the steps of the tour that teaches a step of the guide. */
export function createTour(
  step: OnboardingStep,
  context: TourContext,
): TourStep[] {
  const course = (tab: Parameters<typeof coursePath>[1]) =>
    coursePath(context.sampleCourseId, tab);
  const at = (...targets: (keyof typeof TourTargetEnum)[]) =>
    targets.map((target) => tourSelector(TourTargetEnum[target]));
  const isShown = (target: keyof typeof TourTargetEnum) =>
    document.querySelector(tourSelector(TourTargetEnum[target])) !== null;

  switch (step) {
    case OnboardingStepEnum.CreateCourse:
      return [
        {
          key: 'list',
          targets: at('CoursesTable'),
          path: AdminPathEnum.Courses,
        },
        {
          key: 'add',
          targets: at('CoursesAdd'),
          waitFor: (event) => event.type === PracticeEventEnum.CourseCreated,
        },
        { key: 'tabs', targets: at('CourseTabs') },
      ];

    case OnboardingStepEnum.DesignTemplate:
      if (context.narrow) {
        return [{ key: 'narrow', targets: [] }];
      }
      return [
        {
          key: 'designer',
          targets: at('TemplateDesigner'),
          path: coursePath(context.draftCourseId, CourseTabEnum.Template),
        },
        {
          key: 'fonts',
          targets: at('TemplateFonts'),
          until: () => isShown('FontsModal'),
        },
        {
          key: 'addFont',
          targets: at('FontsModal'),
          interactive: true,
          // the editor shows its warning until a font is loaded
          until: () => !isShown('TemplateNeedsFont'),
        },
        {
          key: 'fieldBar',
          // the whole editor, lit and with the card above, since the name is dragged onto it
          targets: at('TemplateDesigner'),
          interactive: true,
          side: 'top',
        },
        {
          key: 'applyFont',
          // the picker once a text field is selected, else the panel or its toggle
          targets: [
            PdfmeTourTargets.FontSetting,
            PdfmeTourTargets.FieldPanel,
            PdfmeTourTargets.PanelToggle,
          ],
          interactive: true,
        },
        {
          key: 'save',
          targets: at('TemplateSave'),
          interactive: true,
          waitFor: (event) =>
            event.type === PracticeEventEnum.TemplateSaved && event.hasName,
        },
      ];

    case OnboardingStepEnum.AddParticipants:
      return [
        {
          key: 'table',
          targets: at('ParticipantsTable'),
          path: course(CourseTabEnum.Participants),
        },
        { key: 'import', targets: at('ParticipantsImport') },
        {
          key: 'add',
          targets: at('ParticipantsAdd'),
          waitFor: (event) =>
            event.type === PracticeEventEnum.ParticipantsAdded,
        },
      ];

    case OnboardingStepEnum.IssueCertificates:
      return [
        {
          key: 'issue',
          targets: at('CertificatesIssue'),
          path: course(CourseTabEnum.Certificates),
          waitFor: (event) =>
            event.type === PracticeEventEnum.CertificatesIssued,
        },
        { key: 'table', targets: at('CertificatesTable') },
      ];

    case OnboardingStepEnum.BrowseCourse:
      return [
        {
          key: 'list',
          targets: at('CoursesTable'),
          path: AdminPathEnum.Courses,
        },
        {
          key: 'tabs',
          targets: at('CourseTabs'),
          path: course(CourseTabEnum.Participants),
        },
        { key: 'participants', targets: at('ParticipantsTable') },
      ];

    case OnboardingStepEnum.ViewCertificate:
      return [
        {
          key: 'table',
          targets: at('CertificatesTable'),
          path: course(CourseTabEnum.Certificates),
        },
        {
          key: 'sample',
          targets: at('SampleCertificate'),
          onEnter: context.openSampleCertificate,
        },
      ];

    case OnboardingStepEnum.InviteUser:
      return [
        { key: 'table', targets: at('UsersTable'), path: AdminPathEnum.Users },
        {
          key: 'add',
          targets: at('UsersAdd'),
          waitFor: (event) => event.type === PracticeEventEnum.UserCreated,
        },
        { key: 'password', targets: at('UsersTable') },
      ];
  }
}
