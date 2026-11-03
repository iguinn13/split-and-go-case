import { Controller, Get } from '@nestjs/common';
import { CURRENCIES, type Currency } from '../../common/money/currencies.js';

@Controller('currencies')
export class CurrenciesController {
    @Get()
    list(): Currency[] {
        return CURRENCIES.map(({ code, name, minorUnits }) => ({ code, name, minorUnits }));
    }
}
