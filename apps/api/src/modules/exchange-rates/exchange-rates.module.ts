import { Module } from '@nestjs/common';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.schema.js';
import { EXCHANGE_RATE_PROVIDER } from './exchange-rate-provider.js';
import { ExchangeRatesController } from './exchange-rates.controller.js';
import { GetExchangeRateUseCase } from './get-exchange-rate.use-case.js';
import { FrankfurterExchangeRateProvider } from './providers/frankfurter-exchange-rate.provider.js';

@Module({
    controllers: [ExchangeRatesController],
    providers: [
        {
            provide: EXCHANGE_RATE_PROVIDER,
            inject: [ENV],
            useFactory: (env: Env) => new FrankfurterExchangeRateProvider(env.FX_PROVIDER_URL),
        },
        GetExchangeRateUseCase,
    ],
})
export class ExchangeRatesModule {}
