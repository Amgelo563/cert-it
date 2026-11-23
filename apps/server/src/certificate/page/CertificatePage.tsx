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
  /** LinkedIn "Add to Profile" link; null hides the button. */
  linkedInUrl: string | null;
  /** Path of the PDF, shown inline. */
  pdfPath: string;
  /** Path of the signed Open Badges credential, always downloaded. */
  credentialPath: string;
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
            <DownloadMenu
              texts={texts}
              pdfUrl={`${props.pdfPath}?download=1`}
              credentialUrl={props.credentialPath}
            />
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
            {props.linkedInUrl && (
              <a
                class="button button-linkedin"
                href={props.linkedInUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <LinkedInIcon />
                {texts.addToLinkedIn}
                <span class="visually-hidden"> {texts.opensInNewTab}</span>
              </a>
            )}
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

// a split button: the main part downloads the PDF, the menu offers every format; opens without JavaScript
function DownloadMenu(props: {
  texts: Messages['certificatePage'];
  pdfUrl: string;
  credentialUrl: string;
}) {
  const { texts } = props;

  return (
    <div class="download">
      <a class="button button-primary download-main" href={props.pdfUrl}>
        <DownloadIcon />
        {texts.download}
      </a>
      <details class="download-options" data-menu>
        <summary
          class="button button-primary download-toggle"
          aria-label={texts.downloadOptions}
        >
          <ChevronIcon />
        </summary>
        <ul class="download-menu">
          <li>
            {/* the default, as the main button downloads it */}
            <a href={props.pdfUrl} aria-current="true">
              <span class="download-format">
                {texts.downloadPdf}
                <span class="download-hint">{texts.downloadPdfHint}</span>
              </span>
              <SelectedIcon />
            </a>
          </li>
          <li>
            <a href={props.credentialUrl} download>
              <span class="download-format">
                {texts.downloadCredential}
                <span class="download-hint">
                  {texts.downloadCredentialHint}
                </span>
              </span>
            </a>
          </li>
        </ul>
      </details>
    </div>
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

// as the language menu marks its current choice
function SelectedIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12l5 5l10 -10" />
    </svg>
  );
}

function ChevronIcon() {
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
      <path d="m6 9 6 6 6-6" />
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

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
    </svg>
  );
}
