import type { ApiErrorCodeEnum } from '@cert-it/shared';

/** Texts of the panel shell: the layout, navigation, tables and errors. Placeholders are written as `{key}`. */
export type AppMessages = {
  app: {
    /** Title of the browser tab. */
    title: string;
    /** Short name shown next to the logo. */
    name: string;
    loading: string;
  };
  language: {
    /** Name of the language, in itself, for the language switcher. */
    name: string;
    /** Accessible label of the language switcher. */
    switcherLabel: string;
  };
  layout: {
    toggleNavigation: string;
    navigationLabel: string;
    toggleColorScheme: string;
  };
  navigation: {
    overview: string;
    home: string;
    courses: string;
    administration: string;
    users: string;
    auditLog: string;
  };
  /** Shared by the paginated tables. */
  table: {
    /** Rows shown, with `{from}`, `{to}` and `{total}`. */
    range: string;
    firstPage: string;
    previousPage: string;
    nextPage: string;
    lastPage: string;
  };
  errors: {
    notFoundTitle: string;
    notFoundDescription: string;
    forbiddenTitle: string;
    forbiddenDescription: string;
    unexpectedTitle: string;
    unexpectedDescription: string;
    backHome: string;
    reload: string;
  };
  /** Messages for failed API requests. */
  apiErrors: {
    /** One per error code the API answers with, keyed by its member name in ApiErrorCodeEnum, such as invalidRequest. */
    codes: Record<Uncapitalize<keyof typeof ApiErrorCodeEnum>, string>;
    /** No response arrived, such as when offline. */
    network: string;
    /** An error without a known code. */
    unexpected: string;
    /** Too many attempts, with the time to wait in `{wait}`, such as "5 minutes". */
    tooManyAttemptsWait: string;
  };
};
