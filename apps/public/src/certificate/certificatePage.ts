import '@fontsource-variable/inter/wght.css';
import 'virtual:theme.css';
import '../style/public.css';
import { DetailsMenu } from '../menu/DetailsMenu';
import { CertificatePreview } from './CertificatePreview';
import { CopyLinkButton } from './CopyLinkButton';

for (const button of document.querySelectorAll<HTMLButtonElement>(
  'button[data-copy-link]',
)) {
  new CopyLinkButton({ button }).start();
}

const figure = document.querySelector<HTMLElement>('[data-preview]');
if (figure) void new CertificatePreview({ figure }).start();

DetailsMenu.startAll();
