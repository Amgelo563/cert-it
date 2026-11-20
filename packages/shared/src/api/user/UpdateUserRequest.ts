import { boolean, enum as zEnum, type output, strictObject } from 'zod';
import { RoleEnum } from '../../role/RoleEnum';

export const UpdateUserRequestSchema = strictObject({
  role: zEnum(RoleEnum).optional(),
  active: boolean().optional(),
}).refine((body) => body.role !== undefined || body.active !== undefined, {
  message: 'Nothing to update',
});

/** The body of a request to change a user's role or deactivate them. */
export type UpdateUserRequest = output<typeof UpdateUserRequestSchema>;
