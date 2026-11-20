import { type ApiErrorCode, ApiErrorCodeEnum } from '@cert-it/shared';
import type { i18n } from 'i18next';
import type { AdminMessages } from '../i18n/messages/AdminMessages';
import { ApiRequestError } from './errors/ApiRequestError';

type MessageKey = keyof AdminMessages['apiErrors']['codes'];

// the messages are keyed by the enum's member names, such as invalidRequest for invalid_request
const MessageKeys = Object.fromEntries(
  Object.entries(ApiErrorCodeEnum).map(([name, code]) => [
    code,
    `${name.charAt(0).toLowerCase()}${name.slice(1)}`,
  ]),
) as Record<ApiErrorCode, MessageKey>;

/** Returns a translated message for an error thrown by an API request, or a generic one for anything else. */
export function describeApiError(error: unknown, i18n: i18n): string {
  const { t } = i18n;
  if (!(error instanceof ApiRequestError)) return t('apiErrors.unexpected');
  if (error.isNetworkError()) return t('apiErrors.network');

  const { code, retryAfterSeconds } = error;
  if (code === ApiErrorCodeEnum.TooManyAttempts && retryAfterSeconds) {
    return t('apiErrors.tooManyAttemptsWait', {
      wait: formatWait(retryAfterSeconds, i18n.language),
    });
  }

  return code
    ? t(`apiErrors.codes.${MessageKeys[code]}`)
    : t('apiErrors.unexpected');
}

// seconds under a minute, else whole minutes rounded up
function formatWait(seconds: number, language: string): string {
  const inMinutes = seconds >= 60;

  return new Intl.NumberFormat(language, {
    style: 'unit',
    unit: inMinutes ? 'minute' : 'second',
    unitDisplay: 'long',
  }).format(inMinutes ? Math.ceil(seconds / 60) : Math.ceil(seconds));
}
