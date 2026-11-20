import { Result } from 'better-result';
import { AbstractFontCatalog } from '../AbstractFontCatalog';
import type { CatalogFamily } from '../CatalogFamily';
import type { CatalogVariant } from '../CatalogVariant';
import { CatalogFontNotFoundError } from '../errors/CatalogFontNotFoundError';
import type { FontCatalogUnavailableError } from '../errors/FontCatalogUnavailableError';
import type { FontTooLargeError } from '../errors/FontTooLargeError';
import type { FontCatalogOptions } from '../FontCatalogOptions';

type GoogleFontCatalogOptions = FontCatalogOptions & {
  /** Google Fonts Developer API key. Keep it on the server. */
  apiKey: string;
};

/** A family with its file URLs, keyed by Google's variant names. */
type GoogleEntry = { family: CatalogFamily; files: Record<string, string> };

/** Google Fonts, whose files each cover every script the font supports. */
export class GoogleFontCatalog extends AbstractFontCatalog<GoogleEntry> {
  protected static readonly ApiUrl =
    'https://www.googleapis.com/webfonts/v1/webfonts';

  /** Google's names for a variant: `regular`, `italic`, `700`, `700italic`. */
  protected static readonly VariantPattern = /^(\d+)?(regular|italic)?$/;

  protected static readonly RegularWeight = 400;

  protected readonly name = 'Google Fonts';

  protected readonly apiKey: string;

  constructor(options: GoogleFontCatalogOptions) {
    super(options);
    this.apiKey = options.apiKey;
  }

  /** Downloads the font's file, which covers every script, so subset is ignored. */
  public async download(
    id: string,
    variant: CatalogVariant,
    _options?: { subset?: string },
  ): Promise<
    Result<
      Uint8Array,
      CatalogFontNotFoundError | FontCatalogUnavailableError | FontTooLargeError
    >
  > {
    const entries = await this.getEntries();
    if (entries.isErr()) return Result.err(entries.error);

    const entry = entries.value.find(({ family }) => family.id === id);
    const url = entry?.files[this.toVariantName(variant)];
    if (!url) {
      return Result.err(
        new CatalogFontNotFoundError({ catalog: this.name, id, variant }),
      );
    }

    return this.fetchFile(url.replace(/^http:\/\//, 'https://'));
  }

  // most popular first, so searches list them first
  protected getListUrl(): string {
    const query = new URLSearchParams({ key: this.apiKey, sort: 'popularity' });
    return `${GoogleFontCatalog.ApiUrl}?${query.toString()}`;
  }

  protected parseList(json: unknown): GoogleEntry[] | null {
    const items = this.asRecord<'items'>(json)?.items;
    if (!Array.isArray(items)) return null;

    return items.flatMap((item: unknown) => {
      const font = this.asRecord<
        'family' | 'files' | 'category' | 'variants' | 'subsets'
      >(item);
      const files = this.asRecord<string>(font?.files);
      if (typeof font?.family !== 'string' || !files) return [];

      const urls = Object.fromEntries(
        Object.entries(files).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      );

      return [
        {
          family: {
            id: font.family,
            family: font.family,
            category: typeof font.category === 'string' ? font.category : '',
            variants: this.strings(font.variants).flatMap((name) => {
              const variant = this.toVariant(name);
              return variant && urls[name] ? [variant] : [];
            }),
            subsets: this.strings(font.subsets),
            license: null,
          },
          files: urls,
        },
      ];
    });
  }

  protected toFamily(entry: GoogleEntry): CatalogFamily {
    return entry.family;
  }

  protected toVariant(name: string): CatalogVariant | null {
    const match = GoogleFontCatalog.VariantPattern.exec(name);
    if (!match || (!match[1] && !match[2])) return null;

    return {
      weight: match[1] ? Number(match[1]) : GoogleFontCatalog.RegularWeight,
      italic: match[2] === 'italic',
    };
  }

  protected toVariantName(variant: CatalogVariant): string {
    if (variant.weight === GoogleFontCatalog.RegularWeight) {
      return variant.italic ? 'italic' : 'regular';
    }

    return `${variant.weight}${variant.italic ? 'italic' : ''}`;
  }
}
