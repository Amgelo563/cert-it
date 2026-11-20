import { ApiErrorCodeEnum } from '@cert-it/shared';
import { createInstance, type i18n } from 'i18next';
import { describe, expect, test } from 'vite-plus/test';
import { describeApiError } from '../../../../src/app/api/describeApiError';
import { ApiRequestError } from '../../../../src/app/api/errors/ApiRequestError';
import { EnAdminMessages } from '../../../../src/app/i18n/messages/EnAdminMessages';

async function createI18n(): Promise<i18n> {
  const instance = createInstance();
  await instance.init({
    lng: 'en',
    resources: { en: { translation: EnAdminMessages } },
    interpolation: { escapeValue: false, prefix: '{', suffix: '}' },
  });
  return instance;
}

describe('describeApiError', () => {
  test('GIVEN an error with a code WHEN described THEN returns its message', async () => {
    const error = new ApiRequestError({
      status: 409,
      code: ApiErrorCodeEnum.EmailTaken,
    });

    expect(describeApiError(error, await createI18n())).toBe(
      EnAdminMessages.apiErrors.codes.emailTaken,
    );
  });

  test.each(Object.values(ApiErrorCodeEnum))(
    'GIVEN the code %s WHEN described THEN has a message of its own',
    async (code) => {
      const message = describeApiError(
        new ApiRequestError({ status: 400, code }),
        await createI18n(),
      );

      expect(message).not.toContain('apiErrors.');
      expect(message).not.toBe(EnAdminMessages.apiErrors.unexpected);
    },
  );

  test.each([
    [30, '30 seconds'],
    [90, '2 minutes'],
  ])(
    'GIVEN too many attempts with a %i s wait WHEN described THEN says to wait %s',
    async (seconds, wait) => {
      const error = new ApiRequestError({
        status: 429,
        code: ApiErrorCodeEnum.TooManyAttempts,
        retryAfterSeconds: seconds,
      });

      expect(describeApiError(error, await createI18n())).toBe(
        `Too many attempts. Try again in ${wait}.`,
      );
    },
  );

  test('GIVEN a network error WHEN described THEN returns the network message', async () => {
    const error = new ApiRequestError({ status: 0, code: null });

    expect(describeApiError(error, await createI18n())).toBe(
      EnAdminMessages.apiErrors.network,
    );
  });

  test('GIVEN an error that is not from the API WHEN described THEN returns the generic message', async () => {
    expect(describeApiError(new Error('boom'), await createI18n())).toBe(
      EnAdminMessages.apiErrors.unexpected,
    );
  });
});
