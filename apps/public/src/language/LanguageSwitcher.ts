type LanguageSwitcherOptions = {
  /** The `[data-language-switcher]` details element. */
  details: HTMLDetailsElement;
};

/** Closes the language menu on a click outside it, on Escape, or when focus leaves it, as the admin panel's does. */
export class LanguageSwitcher {
  protected readonly details: HTMLDetailsElement;

  constructor(options: LanguageSwitcherOptions) {
    this.details = options.details;
  }

  /** Listens for clicks and keys while the page is open. */
  public start(): void {
    document.addEventListener('click', (event) => {
      if (!this.details.contains(event.target as Node)) this.close();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !this.details.open) return;

      this.close();
      this.details.querySelector('summary')?.focus();
    });

    this.details.addEventListener('focusout', (event) => {
      const next = event.relatedTarget as Node | null;
      if (next && !this.details.contains(next)) this.close();
    });
  }

  protected close(): void {
    this.details.open = false;
  }
}
