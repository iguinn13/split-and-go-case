import { Global, Module } from '@nestjs/common';
import { loadEnv } from './env.schema.js';

export const ENV = Symbol('ENV');

@Global()
@Module({
    providers: [{ provide: ENV, useFactory: () => loadEnv(process.env) }],
    exports: [ENV],
})
export class ConfigModule {}
