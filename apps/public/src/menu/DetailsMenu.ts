type DetailsMenuOptions = {
  /** The `[data-menu]` details element. */
  details: HTMLDetailsElement;
};

/** Closes a details menu on a click outside it or on one of its links, on Escape, or when focus leaves it, as the admin panel's menus do. */
export class DetailsMenu {
  protected readonly details: HTMLDetailsElement;

  constructor(options: DetailsMenuOptions) {
    this.details = options.details;
  }

  /** Starts every `details[data-menu]` of the page. */
  public static startAll(): void {
    for (const details of document.querySelectorAll<HTMLDetailsElement>(
      'details[data-menu]',
    )) {
      new DetailsMenu({ details }).start();
    }
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

    // a download keeps the page, so the menu would stay open
    this.details.addEventListener('click', (event) => {
      if ((event.target as Element).closest('a')) this.close();
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
