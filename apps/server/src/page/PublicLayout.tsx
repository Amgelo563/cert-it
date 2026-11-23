import type { Locale } from '@cert-it/shared';
import type { Child } from 'hono/jsx';
import type { MessagesService } from '../i18n/MessagesService';
import { LanguageSwitcher } from './LanguageSwitcher';
import type { LinkPreview } from './preview/LinkPreview';
import type { PublicPageAssets } from './PublicPageAssets';

type PublicLayoutProps = {
  locale: Locale;
  messages: MessagesService;
  title: string;
  description?: string | undefined;
  /** Name of the issuing organization, shown in the header. */
  orgName: string;
  assets: PublicPageAssets;
  /** Open Graph tags for when the page's link is shared. */
  preview?: LinkPreview | undefined;
  children?: Child;
};

/** The HTML shell of the public pages: no inline scripts or styles, so it works under the domain's strict CSP. */
export function PublicLayout(props: PublicLayoutProps) {
  const {
    locale,
    messages,
    title,
    description,
    orgName,
    assets,
    preview,
    children,
  } = props;

  return (
    <html lang={locale}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        {description && <meta name="description" content={description} />}
        {/* pages hold people's names, so search engines shouldn't list them */}
        <meta name="robots" content="noindex" />
        {preview && <LinkPreviewTags preview={preview} />}
        {assets.styles.map((href) => (
          <link rel="stylesheet" href={href} />
        ))}
        <script type="module" src={assets.script} />
      </head>
      <body>
        <header class="site-header">
          <div class="container">
            <span class="site-org">{orgName}</span>
            <LanguageSwitcher locale={locale} messages={messages} />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}

function LinkPreviewTags(props: { preview: LinkPreview }) {
  const { url, siteName, title, description, image, largeImage, themeColor } =
    props.preview;

  return (
    <>
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      {image && <meta property="og:image" content={image.url} />}
      {image?.type && <meta property="og:image:type" content={image.type} />}
      {image?.alt && <meta property="og:image:alt" content={image.alt} />}
      <meta
        name="twitter:card"
        content={image && largeImage ? 'summary_large_image' : 'summary'}
      />
      <meta name="theme-color" content={themeColor} />
    </>
  );
}
