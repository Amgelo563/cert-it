import type { Locale } from '@cert-it/shared';
import type { Child } from 'hono/jsx';
import type { PublicPageAssets } from './PublicPageAssets';

type PublicLayoutProps = {
  locale: Locale;
  title: string;
  description?: string | undefined;
  /** Name of the issuing organization, shown in the header. */
  orgName: string;
  assets: PublicPageAssets;
  children?: Child;
};

/** The HTML shell of the public pages: no inline scripts or styles, so it works under the domain's strict CSP. */
export function PublicLayout(props: PublicLayoutProps) {
  const { locale, title, description, orgName, assets, children } = props;

  return (
    <html lang={locale}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        {description && <meta name="description" content={description} />}
        {/* pages hold people's names, so search engines shouldn't list them */}
        <meta name="robots" content="noindex" />
        {assets.styles.map((href) => (
          <link rel="stylesheet" href={href} />
        ))}
        <script type="module" src={assets.script} />
      </head>
      <body>
        <header class="site-header">
          <div class="container">
            <span class="site-org">{orgName}</span>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
