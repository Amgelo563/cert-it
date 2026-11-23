type CopyLinkButtonOptions = {
  /** The `[data-copy-link]` button, hidden until this script shows it, with `data-copied-label` and `data-manual-label`. */
  button: HTMLButtonElement;
};

/** Copies a page's link to the clipboard and says so, both on the button and to screen readers. */
export class CopyLinkButton {
  protected static readonly ConfirmMs = 2000;

  protected readonly button: HTMLButtonElement;

  protected readonly label: HTMLElement | null;

  protected readonly status: HTMLElement | null;

  protected resetTimer = 0;

  constructor(options: CopyLinkButtonOptions) {
    this.button = options.button;
    this.label = this.button.querySelector('.button-label');
    this.status = document.getElementById(
      this.button.getAttribute('aria-describedby') ?? '',
    );
  }

  /** Shows the button and copies on click. */
  public start(): void {
    this.button.hidden = false;
    this.button.addEventListener('click', () => void this.copy());
  }

  protected async copy(): Promise<void> {
    const url = this.button.dataset['copyLink'] ?? location.href;
    const copied = await this.write(url);
    if (!copied) {
      // the browser refused both ways, so the visitor copies it by hand
      window.prompt(this.button.dataset['manualLabel'] ?? '', url);
      return;
    }

    const { copiedLabel = '' } = this.button.dataset;
    if (this.status) this.status.textContent = copiedLabel;

    if (this.label) {
      const original = this.button.dataset['label'] ?? this.label.textContent;
      this.button.dataset['label'] = original ?? '';
      this.label.textContent = copiedLabel;

      clearTimeout(this.resetTimer);
      this.resetTimer = window.setTimeout(() => {
        if (this.label) this.label.textContent = original;
        if (this.status) this.status.textContent = '';
      }, CopyLinkButton.ConfirmMs);
    }
  }

  // the Clipboard API needs a secure context, so plain http falls back to a selection
  protected async write(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return this.writeWithSelection(text);
    }
  }

  protected writeWithSelection(text: string): boolean {
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.className = 'visually-hidden';
    document.body.append(field);
    field.select();

    try {
      // deprecated, but the only way without the Clipboard API
      return document.execCommand('copy');
    } finally {
      field.remove();
    }
  }
}
