import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/auth/public.decorator.js';
import { AppError } from '../../common/errors/app-error.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<{ status: 'ok'; database: 'up' }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new AppError('INTERNAL_ERROR', 503, 'Database unavailable');
    }
    return { status: 'ok', database: 'up' };
  }
}
