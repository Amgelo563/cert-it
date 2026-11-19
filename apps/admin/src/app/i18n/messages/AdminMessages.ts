/** Texts of the admin panel, in one language. Placeholders are written as `{key}`. */
export type AdminMessages = {
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
    templates: string;
    templateDesigner: string;
  };
  home: {
    title: string;
    description: string;
    designerCardTitle: string;
    designerCardDescription: string;
    designerCardAction: string;
  };
  templateDesigner: {
    title: string;
    description: string;
  };
  errors: {
    notFoundTitle: string;
    notFoundDescription: string;
    unexpectedTitle: string;
    unexpectedDescription: string;
    backHome: string;
    reload: string;
  };
};
