/** Texts of the server-rendered pages and certificates, in one language. Placeholders are written as `{key}`. */
export type Messages = {
  language: {
    /** Name of the language, in itself, for the language switcher. */
    name: string;
    /** Accessible label of the language switcher. */
    switcherLabel: string;
  };
  certificate: {
    status: {
      valid: string;
      revoked: string;
    };
    /** Placeholders: {org}. */
    issuedBy: string;
  };
  error: {
    notFound: string;
  };
};
