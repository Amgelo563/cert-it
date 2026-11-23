import '@fontsource-variable/inter/wght.css';
import 'virtual:theme.css';
import '../style/public.css';
import { LanguageSwitcher } from '../language/LanguageSwitcher';
import { CertificatePreview } from './CertificatePreview';
import { CopyLinkButton } from './CopyLinkButton';

for (const button of document.querySelectorAll<HTMLButtonElement>(
  'button[data-copy-link]',
)) {
  new CopyLinkButton({ button }).start();
}

const figure = document.querySelector<HTMLElement>('[data-preview]');
if (figure) void new CertificatePreview({ figure }).start();

for (const details of document.querySelectorAll<HTMLDetailsElement>(
  'details[data-language-switcher]',
)) {
  new LanguageSwitcher({ details }).start();
}
