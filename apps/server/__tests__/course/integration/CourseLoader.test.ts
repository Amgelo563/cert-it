import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, test } from 'vite-plus/test';
import type { CourseEnv } from '../../../src/course/CourseEnv';
import { CourseLoader } from '../../../src/course/CourseLoader';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import { createTestDatabase } from '../../database/mocks/createTestDatabase';
import { MockSeeder } from '../../database/mocks/MockSeeder';

let database: DatabaseService;

beforeEach(() => {
  database = createTestDatabase();
});

afterEach(() => {
  database.close();
});

// answers the name of the loaded course
function createApp() {
  const loader = CourseLoader.create({ database });
  return new Hono<CourseEnv>().get(
    '/courses/:courseId',
    loader.middleware(),
    (c) => c.text(c.get('course').name),
  );
}

describe('CourseLoader (middleware)', () => {
  test('GIVEN an existing course WHEN requesting it THEN the route gets the course', async () => {
    const course = new MockSeeder(database.getRepositories()).course({
      name: 'Redes 2026',
    });

    const response = await createApp().request(`/courses/${course.id}`);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('Redes 2026');
  });

  test.each(['999', 'abc', '0'])(
    'GIVEN the course ID %s WHEN requesting it THEN answers 404 without running the route',
    async (id) => {
      const response = await createApp().request(`/courses/${id}`);

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'not_found' });
    },
  );
});
