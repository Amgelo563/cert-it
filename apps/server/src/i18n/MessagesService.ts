import { type Locale, LocaleEnum } from '@cert-it/shared';
import { EnMessages } from './messages/EnMessages';
import { EsMessages } from './messages/EsMessages';
import type { Messages } from './messages/Messages';

/** Gives the texts of each supported language, with their placeholders replaced. */
export class MessagesService {
  protected static readonly Catalogs: Record<Locale, Messages> = {
    [LocaleEnum.En]: EnMessages,
    [LocaleEnum.Es]: EsMessages,
  };

  protected static readonly PlaceholderPattern = /\{(\w+)\}/g;

  /** Returns the raw texts in the given language. */
  public get(locale: Locale): Messages {
    return MessagesService.Catalogs[locale];
  }

  /** Returns "Issued by {org}" in the given language. */
  public issuedBy(locale: Locale, org: string): string {
    return this.format(this.get(locale).certificate.issuedBy, { org });
  }

  protected format(text: string, values: Record<string, string>): string {
    return text.replace(
      MessagesService.PlaceholderPattern,
      (match, key: string) => values[key] ?? match,
    );
  }
}
