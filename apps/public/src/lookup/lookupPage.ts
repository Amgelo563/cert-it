// the form works without JavaScript
import '@fontsource-variable/inter/wght.css';
import 'virtual:theme.css';
import '../style/public.css';
import { LanguageSwitcher } from '../language/LanguageSwitcher';

for (const details of document.querySelectorAll<HTMLDetailsElement>(
  'details[data-language-switcher]',
)) {
  new LanguageSwitcher({ details }).start();
}

document.getElementById('lookup-message')?.focus();
