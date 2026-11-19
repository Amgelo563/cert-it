import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/**/repository/*Table.ts',
  out: './drizzle',
});
