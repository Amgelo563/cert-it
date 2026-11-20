import { AppService } from './app/AppService';
import { ConfigService } from './config/file/ConfigService';

const config = await ConfigService.create().readOrExit();
await AppService.create({ config }).run();
