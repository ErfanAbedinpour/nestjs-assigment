import { BadRequestException, HttpException, type ArgumentsHost } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { DomainError } from '../../domain/error/domain.error';
import { DomainExceptionFilter } from '../domain-exception.filter';

describe('DomainExceptionFilter', () => {
  function handle(error: unknown, requestId?: string) {
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ requestId }),
      }),
    } as unknown as ArgumentsHost;
    new DomainExceptionFilter().catch(error, host);
    return { status, json };
  }

  it('maps domain errors and preserves details and request id', () => {
    const result = handle(
      new DomainError('INSUFFICIENT_BALANCE', 'Not enough', { available: '1' }),
      'req',
    );
    expect(result.status).toHaveBeenCalledWith(422);
    expect(result.json).toHaveBeenCalledWith({
      statusCode: 422,
      code: 'INSUFFICIENT_BALANCE',
      message: 'Not enough',
      details: { available: '1' },
      requestId: 'req',
    });
  });

  it('maps validation messages and handles unknown request ids', () => {
    const result = handle(new BadRequestException(['first', 'second']));
    expect(result.json).toHaveBeenCalledWith({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'first; second',
      requestId: 'unknown',
    });
  });

  it('hides unexpected error details from clients', () => {
    const result = handle(new Error('secret'), 'req');
    expect(result.status).toHaveBeenCalledWith(500);
    expect(result.json).toHaveBeenCalledWith({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      requestId: 'req',
    });
  });

  it('maps non-validation HTTP errors', () => {
    const result = handle(new HttpException('Unavailable', 503));
    expect(result.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 503,
        code: 'HTTP_ERROR',
        message: 'Unavailable',
      }),
    );
  });

  it('uses a default status for unknown domain codes without details', () => {
    const result = handle(new DomainError('OTHER', 'Rule failed'));
    expect(result.json).toHaveBeenCalledWith({
      statusCode: 422,
      code: 'OTHER',
      message: 'Rule failed',
      requestId: 'unknown',
    });
  });

  it('normalizes HTTP messages without exposing unexpected values', () => {
    expect(
      handle(new HttpException({ message: 'Invalid input' }, 400)).json,
    ).toHaveBeenCalledWith(expect.objectContaining({ message: 'Invalid input' }));
    expect(handle(new HttpException({ message: 42 }, 400)).json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Http Exception' }),
    );
    expect(
      handle(new HttpException({ error: 'missing' }, 400)).json,
    ).toHaveBeenCalledWith(expect.objectContaining({ message: 'Http Exception' }));
    expect(handle('failure').json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INTERNAL_ERROR' }),
    );
  });
});
