import { ApiErrorCodeEnum } from '@cert-it/shared';
import type { MiddlewareHandler } from 'hono';
import type { DatabaseService } from '../database/DatabaseService';
import { AbstractApiRoutes } from '../http/api/AbstractApiRoutes';
import type { CourseId } from './Course';
import type { CourseEnv } from './CourseEnv';

type CourseLoaderOptions = {
  database: DatabaseService;
};

/** Loads the course named in the path before a route runs, answering 404 when there isn't one. */
export class CourseLoader {
  protected readonly database: DatabaseService;

  constructor(options: CourseLoaderOptions) {
    this.database = options.database;
  }

  public static create(options: CourseLoaderOptions): CourseLoader {
    return new CourseLoader(options);
  }

  /** Returns a middleware that sets the course variable to the course whose ID is in the given path parameter. */
  public middleware(param = 'courseId'): MiddlewareHandler<CourseEnv> {
    return async (c, next) => {
      const id = AbstractApiRoutes.parseId(c.req.param(param));
      const course =
        id === null
          ? null
          : this.database.getRepositories().courses.findById(id as CourseId);
      if (!course) {
        return AbstractApiRoutes.apiError(c, 404, ApiErrorCodeEnum.NotFound);
      }

      c.set('course', course);
      return next();
    };
  }
}
