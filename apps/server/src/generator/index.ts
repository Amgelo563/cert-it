// entry of the generator process, which BackgroundJobService starts
import type { GeneratorSettings } from './GeneratorSettings';
import { GeneratorService } from './GeneratorService';

const settings = JSON.parse(process.argv[2] ?? '{}') as GeneratorSettings;
await GeneratorService.create({ settings }).start();
