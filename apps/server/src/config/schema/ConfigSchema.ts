import { LocaleEnum, ThemeValues } from '@cert-it/shared';
import ipaddr from 'ipaddr.js';
import {
  array,
  boolean,
  email,
  enum as zEnum,
  int,
  number,
  strictObject,
  type output,
  preprocess,
  string,
  union,
  url,
  type ZodType,
} from 'zod';
import { CronSchedule } from '../../backup/schedule/CronSchedule';
import { FileServeModeEnum } from './enums/FileServeModeEnum';
import { FontCatalogEnum } from './enums/FontCatalogEnum';

/** Treats an empty value ('', null or an empty list) as absent, so `.optional()` / `.default()` apply. */
const blank = <T extends ZodType>(schema: T) =>
  preprocess(
    (value) =>
      value === ''
      || value === null
      || (Array.isArray(value) && value.length === 0)
        ? undefined
        : value,
    schema,
  );

const hexColor = string().regex(
  /^#([0-9a-f]{3}|[0-9a-f]{6})$/i,
  'Must be a hex color',
);

/** A file in the data directory, given relative to it, with one of the extensions the pattern allows. */
const dataFile = (extension: RegExp, message: string) =>
  string()
    .regex(/^[^:]+$/, 'Must be a file in the data directory')
    .regex(extension, message)
    .optional();

const ImageFile = /\.(png|jpe?g|webp|svg)$/i;

const ImageFileMessage = 'Must be a .png, .jpg, .webp or .svg file';

const DefaultBrandColor = ThemeValues.brandShades[ThemeValues.brandShadeIndex];

const DefaultTrustedProxies = [
  '127.0.0.0/8',
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
  '::1/128',
  'fc00::/7',
];

export const ConfigSchema = strictObject({
  site: strictObject({
    baseUrl: url({ protocol: /^https?$/ }),
    previousBaseUrl: blank(url({ protocol: /^https?$/ }).optional()),
    orgName: string().trim().min(1).max(100),
    linkedinOrgId: blank(
      preprocess(
        (value) => (typeof value === 'number' ? String(value) : value),
        string().regex(/^\d+$/).max(20),
      ).optional(),
    ),
    defaultLocale: blank(zEnum(LocaleEnum).default(LocaleEnum.En)),
  }),

  branding: strictObject({
    name: blank(string().trim().min(1).max(60).default('cert-it')),
    primaryColor: blank(hexColor.default(DefaultBrandColor)),
    logo: blank(dataFile(ImageFile, ImageFileMessage)),
    logoDark: blank(dataFile(ImageFile, ImageFileMessage)),
    favicon: blank(
      dataFile(/\.(ico|png|svg)$/i, 'Must be an .ico, .png or .svg file'),
    ),
    font: blank(
      dataFile(
        /\.(woff2?|ttf|otf)$/i,
        'Must be a .woff2, .woff, .ttf or .otf file',
      ),
    ),
    lookupImage: blank(dataFile(ImageFile, ImageFileMessage)),
  }).prefault({}),

  linkPreviews: strictObject({
    siteName: blank(string().max(100).optional()),
    title: blank(string().max(200).optional()),
    description: blank(string().max(500).optional()),
    image: blank(
      union([
        url({ protocol: /^https$/ }),
        string().regex(
          /^[^:]+\.(png|jpe?g|webp)$/i,
          'Must be a .png, .jpg or .webp file, or an https URL',
        ),
      ]).optional(),
    ),
    imageAlt: blank(string().max(200).optional()),
    largeImage: blank(boolean().default(true)),
    themeColor: blank(hexColor.optional()),
    discordComponentEmbed: blank(boolean().default(true)),
  }).prefault({}),

  admin: strictObject({
    email: email(),
  }),

  server: strictObject({
    trustedProxies: blank(
      array(
        string().refine((value: string): boolean => {
          try {
            ipaddr.parseCIDR(value);
            return true;
          } catch {
            return false;
          }
        }, 'Must be a CIDR range'),
      ).default(DefaultTrustedProxies),
    ),
    port: blank(int().positive().default(3000)),
    dataDir: blank(string().trim().min(1).default('data')),
  }).prefault({}),

  files: strictObject({
    serve: blank(zEnum(FileServeModeEnum).default(FileServeModeEnum.Stream)),
  }).prefault({}),

  uploads: strictObject({
    maxPdfMb: blank(number().positive().default(5)),
    maxFontMb: blank(number().positive().default(8)),
  }).prefault({}),

  fonts: strictObject({
    catalog: blank(zEnum(FontCatalogEnum).default(FontCatalogEnum.Fontsource)),
    googleApiKey: blank(string().optional()),
  })
    .prefault({})
    .refine(
      (fonts) => fonts.catalog !== FontCatalogEnum.Google || fonts.googleApiKey,
      {
        message: 'Required when catalog is google',
        path: ['googleApiKey'],
      },
    ),

  auth: strictObject({
    rateLimit: strictObject({
      maxAttempts: blank(int().positive().default(15)),
      windowMinutes: blank(number().positive().default(1)),
    }).prefault({}),
  }).prefault({}),

  lookup: strictObject({
    rateLimit: strictObject({
      maxRequests: blank(int().positive().default(10)),
      windowMinutes: blank(number().positive().default(10)),
    }).prefault({}),
  }).prefault({}),

  backup: strictObject({
    enabled: blank(boolean().default(false)),
    schedule: blank(
      string()
        .refine(
          (schedule) => CronSchedule.parse(schedule) !== null,
          'Must be a 5-field cron expression',
        )
        .default('0 3 * * *'),
    ),
    retentionDays: blank(int().positive().default(30)),
    retentionCopies: blank(int().positive().optional()),
    remotes: blank(
      array(
        string().regex(/^[^:\s]+:/, 'Must be an rclone remote:path'),
      ).default([]),
    ),
  })
    .prefault({})
    .refine((backup) => !backup.enabled || backup.remotes.length > 0, {
      message: 'At least one remote is required when backups are enabled',
      path: ['remotes'],
    }),
});

export type Config = output<typeof ConfigSchema>;
