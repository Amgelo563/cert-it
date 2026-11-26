import { email, enum as zEnum, type output, strictObject, string } from 'zod';
import { RoleEnum } from '../../role/RoleEnum';
import { UserName } from './UserName';

export const CreateUserRequestSchema = strictObject({
  email: string().trim().max(254).pipe(email()),
  name: UserName,
  role: zEnum(RoleEnum),
});

/** The body of a request to add an admin panel user. */
export type CreateUserRequest = output<typeof CreateUserRequestSchema>;
