import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Controller, Get, type INestApplication, Module, Post, Body } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { z } from 'zod';
import { AppModule } from '../src/app.module.js';
import { AppError } from '../src/common/errors/app-error.js';
import type { ErrorResponse } from '../src/common/errors/error-response.js';
import { ZodValidationPipe } from '../src/common/zod/zod-validation.pipe.js';

const bodySchema = z.object({ name: z.string().min(1) });

@Controller('probe')
class ProbeController {
  @Post()
  create(@Body(new ZodValidationPipe(bodySchema)) body: z.infer<typeof bodySchema>) {
    return body;
  }

  @Get('app-error')
  appError(): never {
    throw new AppError('GROUP_CLOSED', 409, 'Group is closed');
  }

  @Get('boom')
  boom(): never {
    throw new Error('secret database detail');
  }
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

describe('API base (e2e)', () => {
  let app: INestApplication;
  const server = (): Server => app.getHttpServer() as Server;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, ProbeModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns 200 { status: "ok" }', async () => {
    const res = await request(server()).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('returns 422 VALIDATION_ERROR with details', async () => {
    const res = await request(server()).post('/probe').send({}).expect(422);
    expect(res.body).toMatchObject({
      statusCode: 422,
      code: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: [{ path: 'name' }],
    });
  });

  it('formats AppError', async () => {
    const res = await request(server()).get('/probe/app-error').expect(409);
    expect(res.body).toEqual({ statusCode: 409, code: 'GROUP_CLOSED', message: 'Group is closed' });
  });

  it('turns unknown errors into 500 INTERNAL_ERROR without leaking details', async () => {
    const res = await request(server()).get('/probe/boom').expect(500);
    expect(res.body).toEqual({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
  });

  it('returns NOT_FOUND for unknown routes', async () => {
    const res = await request(server()).get('/nope').expect(404);
    expect((res.body as ErrorResponse).code).toBe('NOT_FOUND');
  });
});
