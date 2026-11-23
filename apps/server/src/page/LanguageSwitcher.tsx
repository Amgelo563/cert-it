import { type Locale, LocaleEnum } from '@cert-it/shared';
import type { MessagesService } from '../i18n/MessagesService';

type LanguageSwitcherProps = {
  /** Language the page is shown in. */
  locale: Locale;
  messages: MessagesService;
};

/** Menu like the admin panel's, linking to the current page in each language. Opens without JavaScript; the lang query saves the choice. */
export function LanguageSwitcher(props: LanguageSwitcherProps) {
  const { locale, messages } = props;
  const label = messages.get(locale).language.switcherLabel;

  return (
    <details class="language-switcher" data-menu>
      {/* the name keeps the visible code, so voice control finds it */}
      <summary class="language-switcher-button">
        <LanguageIcon />
        <span class="visually-hidden">{label}: </span>
        {locale.toUpperCase()}
      </summary>
      <nav class="language-switcher-menu" aria-label={label}>
        <span class="language-switcher-label" aria-hidden="true">
          {label}
        </span>
        <ul>
          {Object.values(LocaleEnum).map((option) => (
            <li>
              {/* query only, so the link keeps the current path */}
              <a
                href={`?lang=${option}`}
                hreflang={option}
                lang={option}
                aria-current={option === locale ? 'true' : undefined}
              >
                {messages.get(option).language.name}
                {option === locale && <CheckIcon />}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </details>
  );
}

// same icons as the admin panel
function LanguageIcon() {
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
      <path d="M9 6.371c0 4.418 -2.239 6.629 -5 6.629" />
      <path d="M4 6.371h7" />
      <path d="M5 9c0 2.144 2.252 3.908 6 4" />
      <path d="M12 20l4 -9l4 9" />
      <path d="M19.1 18h-6.2" />
      <path d="M6.694 3l.793 .582" />
    </svg>
  );
}

function CheckIcon() {
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
