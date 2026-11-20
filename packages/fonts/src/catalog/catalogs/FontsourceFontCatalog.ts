import { Result } from 'better-result';
import { AbstractFontCatalog } from '../AbstractFontCatalog';
import type { CatalogFamily } from '../CatalogFamily';
import type { CatalogVariant } from '../CatalogVariant';
import { CatalogFontNotFoundError } from '../errors/CatalogFontNotFoundError';
import type { FontCatalogUnavailableError } from '../errors/FontCatalogUnavailableError';
import type { FontTooLargeError } from '../errors/FontTooLargeError';

/** The per-font answer's file URLs, as variants[weight][style][subset].url.ttf. */
type FontsourceVariants = Record<
  string,
  Record<string, Record<string, { url?: { ttf?: string } }>> | undefined
>;

/** Fontsource (fontsource.org), whose fonts are split into one file per script. */
export class FontsourceFontCatalog extends AbstractFontCatalog<CatalogFamily> {
  protected static readonly ApiUrl = 'https://api.fontsource.org/v1/fonts';

  protected readonly name = 'Fontsource';

  /** Downloads the font's file for the given subset, or for its default subset (usually `latin`) without one. */
  public async download(
    id: string,
    variant: CatalogVariant,
    options: { subset?: string } = {},
  ): Promise<
    Result<
      Uint8Array,
      CatalogFontNotFoundError | FontCatalogUnavailableError | FontTooLargeError
    >
  > {
    const json = await this.fetchJson(
      `${FontsourceFontCatalog.ApiUrl}/${encodeURIComponent(id)}`,
    );
    if (json.isErr()) return Result.err(json.error);

    const font = this.asRecord<'defSubset' | 'variants'>(json.value);
    const subset =
      options.subset
      ?? (typeof font?.defSubset === 'string' ? font.defSubset : null);
    const variants = (this.asRecord(font?.variants)
      ?? null) as FontsourceVariants | null;
    const url =
      subset
      && variants?.[String(variant.weight)]?.[
        variant.italic ? 'italic' : 'normal'
      ]?.[subset]?.url?.ttf;

    if (!url) {
      return Result.err(
        new CatalogFontNotFoundError({
          catalog: this.name,
          id,
          variant,
          subset,
        }),
      );
    }

    return this.fetchFile(url);
  }

  protected getListUrl(): string {
    return FontsourceFontCatalog.ApiUrl;
  }

  protected parseList(json: unknown): CatalogFamily[] | null {
    if (!Array.isArray(json)) return null;

    return json.flatMap((item: unknown) => {
      const font = this.asRecord<
        | 'id'
        | 'family'
        | 'weights'
        | 'styles'
        | 'category'
        | 'subsets'
        | 'license'
      >(item);
      if (
        typeof font?.id !== 'string'
        || typeof font.family !== 'string'
        || !Array.isArray(font.weights)
        || !Array.isArray(font.styles)
      ) {
        return [];
      }

      const weights = font.weights.filter(
        (weight): weight is number => typeof weight === 'number',
      );
      const styles = font.styles.filter(
        (style) => style === 'normal' || style === 'italic',
      );

      return [
        {
          id: font.id,
          family: font.family,
          category: typeof font.category === 'string' ? font.category : '',
          variants: weights.flatMap((weight) =>
            styles.map((style) => ({ weight, italic: style === 'italic' })),
          ),
          subsets: this.strings(font.subsets),
          license: typeof font.license === 'string' ? font.license : null,
        },
      ];
    });
  }

  protected toFamily(entry: CatalogFamily): CatalogFamily {
    return entry;
  }
}
