export const LocaleEnum = {
  Es: 'es',
  En: 'en',
} as const;

/** A language the app's public pages and courses can be shown in. */
export type Locale = (typeof LocaleEnum)[keyof typeof LocaleEnum];
