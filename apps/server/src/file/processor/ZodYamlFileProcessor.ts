import type { output, ZodType } from 'zod';
import { FileProcessor } from '@cert-it/shared';
import { ZodValidator } from '../validator/ZodValidator';
import { YamlIO } from '../io/YamlIO';

export class ZodYamlFileProcessor<Schema extends ZodType> extends FileProcessor<
  output<Schema>
> {
  constructor(options: {
    path: string;
    schema: Schema;
    camelizeKeys?: boolean;
  }) {
    super({
      validator: new ZodValidator(options.schema),
      io: options.camelizeKeys ? YamlIO.CamelizedInstance : YamlIO.Instance,
      path: YamlIO.buildName(options.path),
    });
  }
}
