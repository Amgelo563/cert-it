import type { Locale } from '@cert-it/shared';
import type { MessagesService } from '../i18n/MessagesService';

/** The Hono environment of the app's routes. */
export type HttpEnv = {
  Variables: {
    /** Client IP of the request, from the connection or a trusted proxy. */
    clientIp: string;
    /** Language the page is shown in. Course pages replace it once they know the course. */
    locale: Locale;
    /** Texts of the pages, read in {@link locale}. */
    messages: MessagesService;
  };
};
