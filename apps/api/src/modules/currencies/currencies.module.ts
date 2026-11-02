import { Module } from '@nestjs/common';
import { CurrenciesController } from './currencies.controller.js';

@Module({ controllers: [CurrenciesController] })
export class CurrenciesModule {}
