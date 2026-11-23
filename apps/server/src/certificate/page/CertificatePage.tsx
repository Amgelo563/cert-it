import type { Messages } from '../../i18n/messages/Messages';

type CertificatePageProps = {
  texts: Messages['certificatePage'];
  /** Fills a text's placeholders. */
  format: (text: string, values: Record<string, string>) => string;
  code: string;
  holderName: string;
  courseName: string;
  /** Formatted with the course's locale and date format. */
  issueDate: string;
  orgName: string;
  /** Absolute public URL of this page, for the copy-link button. */
  pageUrl: string;
  /** Path of the PDF, shown inline. */
  pdfPath: string;
  /** Null while the certificate is active. */
  revoked: { date: string; reason: string | null } | null;
};

/** The main content of a certificate's public page: status, holder, preview, actions and details. */
export function CertificatePage(props: CertificatePageProps) {
  const { texts, format, revoked } = props;
  const names = { name: props.holderName, course: props.courseName };

  return (
    <main
      class={`container certificate${revoked ? ' certificate-revoked' : ''}`}
    >
      <div class="certificate-summary">
        {revoked ? (
          <p class="status status-revoked">
            <CrossIcon />
            {texts.revoked}
          </p>
        ) : (
          <p class="status status-valid">
            <CheckIcon />
            {texts.valid}
          </p>
        )}
        <h1 class="holder">{props.holderName}</h1>
        <p class="course">{props.courseName}</p>
      </div>

      {revoked ? (
        <div class="certificate-notice notice" role="note">
          <p>{format(texts.revokedOn, { date: revoked.date })}</p>
          {revoked.reason && (
            <p>{format(texts.revokedReason, { reason: revoked.reason })}</p>
          )}
          <p>{format(texts.revokedHelp, { org: props.orgName })}</p>
        </div>
      ) : (
        <>
          <figure
            class="certificate-preview preview"
            data-preview
            data-pdf-url={props.pdfPath}
            aria-busy="true"
          >
            {/* a skeleton until the script draws the page or shows the fallback */}
            <div class="preview-frame is-loading">
              <canvas
                class="preview-canvas"
                role="img"
                aria-label={format(texts.previewLabel, names)}
                hidden
              />
              <p class="preview-loading">{texts.loadingPreview}</p>
              <PreviewFallback texts={texts} pdfPath={props.pdfPath} hidden />
              <noscript>
                <PreviewFallback texts={texts} pdfPath={props.pdfPath} />
              </noscript>
            </div>
          </figure>

          <div class="certificate-actions">
            <a
              class="button button-primary"
              href={`${props.pdfPath}?download=1`}
            >
              <DownloadIcon />
              {texts.download}
            </a>
            <button
              type="button"
              class="button"
              data-copy-link={props.pageUrl}
              data-copied-label={texts.linkCopied}
              data-manual-label={texts.copyLinkManually}
              aria-describedby="copy-link-status"
              hidden
            >
              <LinkIcon />
              <span class="button-label">{texts.copyLink}</span>
            </button>
            <span id="copy-link-status" class="visually-hidden" role="status" />
          </div>
        </>
      )}

      <dl class="certificate-details details">
        <div>
          <dt>{texts.course}</dt>
          <dd>{props.courseName}</dd>
        </div>
        <div>
          <dt>{texts.issueDate}</dt>
          <dd>{props.issueDate}</dd>
        </div>
        <div>
          <dt>{texts.issuer}</dt>
          <dd>{props.orgName}</dd>
        </div>
        <div>
          <dt>{texts.code}</dt>
          <dd class="code">{props.code}</dd>
        </div>
      </dl>
    </main>
  );
}

// covers the skeleton when there's no preview: without JavaScript, or when drawing fails
function PreviewFallback(props: {
  texts: Messages['certificatePage'];
  pdfPath: string;
  hidden?: boolean;
}) {
  return (
    <div class="preview-fallback" hidden={props.hidden}>
      <p>{props.texts.previewUnavailable}</p>
      <a href={props.pdfPath}>{props.texts.viewPdf}</a>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m9.5 9.5 5 5m0-5-5 5" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19h14" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
    </svg>
  );
}
