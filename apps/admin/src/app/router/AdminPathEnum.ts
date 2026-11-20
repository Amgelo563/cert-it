/** Paths of the admin pages, relative to the router's basename. */
export const AdminPathEnum = {
  Home: '/',
  Login: '/login',
  ChangePassword: '/change-password',
  Courses: '/courses',
  /** A course's page, whose tabs are in CourseTabEnum. */
  Course: '/courses/:courseId',
  Users: '/users',
  AuditLog: '/audit-log',
} as const;

/** The path of an admin page. */
export type AdminPath = (typeof AdminPathEnum)[keyof typeof AdminPathEnum];
