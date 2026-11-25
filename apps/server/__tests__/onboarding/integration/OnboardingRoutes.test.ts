import {
  type OnboardingState,
  OnboardingStepEnum,
  type Role,
  RoleEnum,
} from '@cert-it/shared';
import { afterEach, describe, expect, test } from 'vite-plus/test';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import { createTestDatabase } from '../../database/mocks/createTestDatabase';
import { createApiHarness } from '../../http/mocks/createApiHarness';

const databases: DatabaseService[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

async function setupRoutes(role: Role = RoleEnum.Admin) {
  const database = createTestDatabase();
  databases.push(database);
  const harness = createApiHarness(database);
  const { cookie } = await harness.loginAs({ role });
  const send = async (method: 'GET' | 'PUT', path = '') => {
    const response = await harness.request(method, `/onboarding${path}`, {
      cookie,
    });
    return {
      status: response.status,
      body: (await response.json()) as OnboardingState,
    };
  };

  return { ...harness, send };
}

describe('OnboardingRoutes (access)', () => {
  test('GIVEN no session WHEN reading the progress THEN answers 401', async () => {
    const database = createTestDatabase();
    databases.push(database);

    const response = await createApiHarness(database).request(
      'GET',
      '/onboarding',
    );

    expect(response.status).toBe(401);
  });
});

describe('OnboardingRoutes (progress)', () => {
  test('GIVEN a new user WHEN reading the progress THEN answers nothing done', async () => {
    const { send } = await setupRoutes();

    expect(await send('GET')).toEqual({
      status: 200,
      body: { dismissed: false, completedSteps: [] },
    });
  });

  test('GIVEN steps completed out of order and twice WHEN reading THEN answers each once in guide order', async () => {
    const { send } = await setupRoutes();
    await send('PUT', `/steps/${OnboardingStepEnum.IssueCertificates}`);
    await send('PUT', `/steps/${OnboardingStepEnum.CreateCourse}`);
    await send('PUT', `/steps/${OnboardingStepEnum.CreateCourse}`);

    const { body } = await send('GET');

    expect(body.completedSteps).toEqual([
      OnboardingStepEnum.CreateCourse,
      OnboardingStepEnum.IssueCertificates,
    ]);
  });

  test('GIVEN a viewer WHEN completing a step of another role THEN answers 400', async () => {
    const { send } = await setupRoutes(RoleEnum.Viewer);

    const { status } = await send(
      'PUT',
      `/steps/${OnboardingStepEnum.CreateCourse}`,
    );

    expect(status).toBe(400);
  });

  test('GIVEN an unknown step WHEN completing it THEN answers 400', async () => {
    const { send } = await setupRoutes();

    expect((await send('PUT', '/steps/unknown')).status).toBe(400);
  });

  test('GIVEN a user WHEN dismissing the guide twice THEN stays dismissed', async () => {
    const { send } = await setupRoutes();
    await send('PUT', '/dismissed');

    const { status, body } = await send('PUT', '/dismissed');

    expect(status).toBe(200);
    expect(body.dismissed).toBe(true);
  });
});
