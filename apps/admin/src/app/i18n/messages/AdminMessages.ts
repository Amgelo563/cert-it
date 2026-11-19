/** Texts of the admin panel, in one language. Placeholders are written as `{key}`. */
export type AdminMessages = {
  app: {
    title: string;
  };
  language: {
    /** Name of the language, in itself, for the language switcher. */
    name: string;
    /** Accessible label of the language switcher. */
    switcherLabel: string;
  };
};
