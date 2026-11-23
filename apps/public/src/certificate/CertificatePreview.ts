import type { PDFPageProxy, RenderTask } from 'pdfjs-dist';
// oxlint-disable-next-line import/default -- Vite gives ?url imports a default export
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

type CertificatePreviewOptions = {
  /** The `[data-preview]` figure: a frame showing a skeleton (`is-loading`), with the canvas and the hidden fallback. */
  figure: HTMLElement;
};

/** Draws page 1 of a certificate's PDF into a canvas, sharp at its displayed size, or shows the fallback link if anything fails. */
export class CertificatePreview {
  /** Most canvas pixels drawn (about 32 MB): a 1600 px wide preview at 2x, safe on phones. */
  public static readonly MaxPixels = 8_000_000;

  protected static readonly RedrawDelayMs = 250;

  // grows for sharpness right away, shrinks only when far too big, to free memory
  protected static readonly GrowRatio = 1.05;

  protected static readonly ShrinkRatio = 0.6;

  protected readonly figure: HTMLElement;

  protected readonly frame: HTMLElement;

  protected readonly fallback: HTMLElement | null;

  protected canvas: HTMLCanvasElement;

  protected page: PDFPageProxy | null = null;

  protected task: RenderTask | null = null;

  protected redrawTimer = 0;

  constructor(options: CertificatePreviewOptions) {
    this.figure = options.figure;
    this.frame = this.query('.preview-frame');
    this.canvas = this.query('canvas');
    this.fallback = this.figure.querySelector('.preview-fallback');
  }

  /** Loads pdf.js and the PDF, then draws page 1. */
  public async start(): Promise<void> {
    try {
      const url = this.figure.dataset['pdfUrl'];
      if (!url) throw new Error('The preview has no data-pdf-url');

      this.page = await this.loadPage(url);
      const { width, height } = this.page.getViewport({ scale: 1 });
      this.frame.style.aspectRatio = `${width} / ${height}`;

      const drawn = await this.draw();
      if (!drawn) throw new Error('The first draw was cancelled');

      this.canvas.hidden = false;
      this.watchSize();
    } catch (error) {
      // the PDF can still be opened from the fallback link
      if (this.fallback) this.fallback.hidden = false;
      console.warn('Certificate preview failed', error);
    } finally {
      this.frame.classList.remove('is-loading');
      this.figure.setAttribute('aria-busy', 'false');
    }
  }

  protected async loadPage(url: string): Promise<PDFPageProxy> {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

    // copied next to the assets under the pdf.js version by the build; a variable, or Vite rewrites it as an asset import
    const folder = `../pdfjs/${pdfjs.version}/`;
    const files = new URL(/* @vite-ignore */ folder, import.meta.url);
    const document = await pdfjs.getDocument({
      url,
      // the strict CSP blocks WebAssembly, so the JS decoders load from here
      wasmUrl: new URL('wasm/', files).href,
      useWasm: false,
      // phones lack Helvetica and the other fonts PDFs may leave out
      standardFontDataUrl: new URL('standard_fonts/', files).href,
      useSystemFonts: false,
    }).promise;

    return document.getPage(1);
  }

  // into a new canvas once one is shown, swapped in when done so nothing flashes
  protected async draw(): Promise<boolean> {
    const { page } = this;
    if (!page) return false;

    const viewport = page.getViewport({ scale: this.targetScale(page) });
    const target = this.canvas.hidden ? this.canvas : this.cloneCanvas();
    target.width = Math.floor(viewport.width);
    target.height = Math.floor(viewport.height);

    this.task?.cancel();
    const task = page.render({ canvas: target, viewport });
    this.task = task;
    try {
      await task.promise;
    } catch {
      // cancelled by a newer draw
      return false;
    }

    if (target !== this.canvas) {
      this.canvas.replaceWith(target);
      this.canvas = target;
    }
    return true;
  }

  // one canvas pixel per device pixel at the displayed width, within the pixel budget
  protected targetScale(page: PDFPageProxy): number {
    const { width, height } = page.getViewport({ scale: 1 });
    const wanted = (this.frame.clientWidth * devicePixelRatio) / width;
    const max = Math.sqrt(CertificatePreview.MaxPixels / (width * height));
    return Math.min(wanted, max);
  }

  protected cloneCanvas(): HTMLCanvasElement {
    const canvas = this.canvas.cloneNode(false) as HTMLCanvasElement;
    canvas.hidden = false;
    return canvas;
  }

  protected watchSize(): void {
    new ResizeObserver(() => this.scheduleRedraw()).observe(this.frame);
    this.watchDensity();
  }

  // moving the window to another screen changes the density without resizing
  protected watchDensity(): void {
    matchMedia(`(resolution: ${devicePixelRatio}dppx)`).addEventListener(
      'change',
      () => {
        this.scheduleRedraw();
        this.watchDensity();
      },
      { once: true },
    );
  }

  protected scheduleRedraw(): void {
    clearTimeout(this.redrawTimer);
    this.redrawTimer = window.setTimeout(() => {
      const { page } = this;
      if (!page) return;

      const wanted = page.getViewport({ scale: this.targetScale(page) }).width;
      const current = this.canvas.width;
      if (
        wanted > current * CertificatePreview.GrowRatio
        || wanted < current * CertificatePreview.ShrinkRatio
      ) {
        void this.draw();
      }
    }, CertificatePreview.RedrawDelayMs);
  }

  protected query<T extends Element>(selector: string): T {
    const element = this.figure.querySelector<T>(selector);
    if (!element) throw new Error(`Missing ${selector} in the preview`);
    return element;
  }
}
