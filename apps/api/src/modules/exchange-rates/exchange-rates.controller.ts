import { Controller, Get, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe.js';
import {
  type ExchangeRateQuery,
  type ExchangeRateView,
  exchangeRateQuerySchema,
} from './exchange-rate.schemas.js';
import { GetExchangeRateUseCase } from './get-exchange-rate.use-case.js';

@Controller('exchange-rates')
export class ExchangeRatesController {
  constructor(private readonly getRate: GetExchangeRateUseCase) {}

  @Get()
  get(
    @Query(new ZodValidationPipe<ExchangeRateQuery>(exchangeRateQuerySchema))
    query: ExchangeRateQuery,
  ): Promise<ExchangeRateView> {
    return this.getRate.execute(query);
  }
}
