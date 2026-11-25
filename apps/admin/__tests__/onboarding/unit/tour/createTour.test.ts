import { OnboardingStepEnum } from '@cert-it/shared';
import { describe, expect, test } from 'vite-plus/test';
import { enumMessageKeys } from '../../../../src/app/i18n/enumMessageKeys';
import { EnOnboardingMessages } from '../../../../src/onboarding/i18n/EnOnboardingMessages';
import { EsOnboardingMessages } from '../../../../src/onboarding/i18n/EsOnboardingMessages';
import { PracticeEventEnum } from '../../../../src/onboarding/practice/PracticeEventEnum';
import {
  createTour,
  type TourContext,
} from '../../../../src/onboarding/tour/createTour';

const Context: TourContext = {
  sampleCourseId: 2,
  draftCourseId: 1,
  narrow: false,
  openSampleCertificate: () => {},
};

describe('createTour (template)', () => {
  test('GIVEN the template tour WHEN the user saves without the name THEN it waits on', () => {
    const save = createTour(OnboardingStepEnum.DesignTemplate, Context).find(
      (step) => step.key === 'save',
    );

    expect(
      save?.waitFor?.({
        type: PracticeEventEnum.TemplateSaved,
        courseId: 1,
        hasName: false,
      }),
    ).toBe(false);
    expect(
      save?.waitFor?.({
        type: PracticeEventEnum.TemplateSaved,
        courseId: 1,
        hasName: true,
      }),
    ).toBe(true);
  });

  test('GIVEN the template tour WHEN it starts THEN it opens the draft course', () => {
    const [first] = createTour(OnboardingStepEnum.DesignTemplate, Context);

    expect(first?.path).toBe('/courses/1/template');
  });

  test('GIVEN a narrow screen WHEN building the template tour THEN it only explains why', () => {
    const steps = createTour(OnboardingStepEnum.DesignTemplate, {
      ...Context,
      narrow: true,
    });

    expect(steps.map((step) => step.key)).toEqual(['narrow']);
  });
});

describe('createTour (steps)', () => {
  test.each(Object.values(OnboardingStepEnum))(
    'GIVEN the %s step WHEN building its tour THEN every step has a message key and the first opens a page',
    (step) => {
      const steps = createTour(step, Context);
      const tour = enumMessageKeys(OnboardingStepEnum)[step];
      const keys = steps.map((each) => each.key);

      expect(steps[0]?.path ?? null).not.toBeNull();
      for (const messages of [EnOnboardingMessages, EsOnboardingMessages]) {
        const texts: Record<string, unknown> = messages.onboarding.tours[tour];
        expect(keys.filter((key) => !(key in texts))).toEqual([]);
      }
    },
  );
});
