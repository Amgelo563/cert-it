import type { ClientIpEnv } from '@cert-it/hono';
import type { Locale } from '@cert-it/shared';
import type { LocaleSources } from '../i18n/LocaleResolver';
import type { MessagesService } from '../i18n/MessagesService';

/** The Hono environment of the app's routes. */
export type HttpEnv = ClientIpEnv & {
  Variables: {
    /** Language the page is shown in. Course pages replace it once they know the course. */
    locale: Locale;
    /** What {@link locale} was picked from, so course pages can pick again with the course's language. */
    localeSources: LocaleSources;
    /** Texts of the pages, read in {@link locale}. */
    messages: MessagesService;
  };
};
