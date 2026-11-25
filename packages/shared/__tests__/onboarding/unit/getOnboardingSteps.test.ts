import { describe, expect, test } from 'vite-plus/test';
import { getOnboardingSteps } from '../../../src/onboarding/getOnboardingSteps';
import { OnboardingStepEnum } from '../../../src/onboarding/OnboardingStepEnum';
import { RoleEnum } from '../../../src/role/RoleEnum';

describe('getOnboardingSteps', () => {
  test('GIVEN an admin WHEN listing steps THEN answers every editing flow and the invite, in order', () => {
    expect(getOnboardingSteps(RoleEnum.Admin)).toEqual([
      OnboardingStepEnum.CreateCourse,
      OnboardingStepEnum.DesignTemplate,
      OnboardingStepEnum.AddParticipants,
      OnboardingStepEnum.IssueCertificates,
      OnboardingStepEnum.ViewCertificate,
      OnboardingStepEnum.InviteUser,
    ]);
  });

  test('GIVEN an editor WHEN listing steps THEN leaves out the invite', () => {
    expect(getOnboardingSteps(RoleEnum.Editor)).not.toContain(
      OnboardingStepEnum.InviteUser,
    );
  });

  test('GIVEN a viewer WHEN listing steps THEN answers only browsing and the certificate', () => {
    expect(getOnboardingSteps(RoleEnum.Viewer)).toEqual([
      OnboardingStepEnum.BrowseCourse,
      OnboardingStepEnum.ViewCertificate,
    ]);
  });
});
