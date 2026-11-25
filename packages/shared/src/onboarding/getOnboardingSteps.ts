import { PermissionEnum } from '../role/PermissionEnum';
import { hasPermission } from '../role/PermissionMatrix';
import type { Role } from '../role/RoleEnum';
import { type OnboardingStep, OnboardingStepEnum } from './OnboardingStepEnum';

/** Returns the steps of the getting started guide the role can take, in the order to take them. */
export function getOnboardingSteps(role: Role): OnboardingStep[] {
  const can = (permission: Parameters<typeof hasPermission>[1]) =>
    hasPermission(role, permission);
  const steps: OnboardingStep[] = [];

  if (can(PermissionEnum.EditCourses)) {
    steps.push(
      OnboardingStepEnum.CreateCourse,
      OnboardingStepEnum.DesignTemplate,
    );
  } else {
    steps.push(OnboardingStepEnum.BrowseCourse);
  }
  if (can(PermissionEnum.EditParticipants)) {
    steps.push(OnboardingStepEnum.AddParticipants);
  }
  if (can(PermissionEnum.IssueCertificates)) {
    steps.push(OnboardingStepEnum.IssueCertificates);
  }
  steps.push(OnboardingStepEnum.ViewCertificate);
  if (can(PermissionEnum.ManageUsers)) {
    steps.push(OnboardingStepEnum.InviteUser);
  }

  return steps;
}
