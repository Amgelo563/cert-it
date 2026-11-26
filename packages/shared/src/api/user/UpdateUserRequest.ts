import { boolean, enum as zEnum, type output, strictObject } from 'zod';
import { RoleEnum } from '../../role/RoleEnum';
import { UserName } from './UserName';

export const UpdateUserRequestSchema = strictObject({
  name: UserName.optional(),
  role: zEnum(RoleEnum).optional(),
  active: boolean().optional(),
}).refine(
  (body) =>
    body.name !== undefined
    || body.role !== undefined
    || body.active !== undefined,
  {
    message: 'Nothing to update',
  },
);

/** The body of a request to rename a user, change their role or deactivate them. */
export type UpdateUserRequest = output<typeof UpdateUserRequestSchema>;
