import 'i18next';
import type { AdminMessages } from './messages/AdminMessages';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: AdminMessages };
    interpolationPrefix: '{';
    interpolationSuffix: '}';
  }
}
