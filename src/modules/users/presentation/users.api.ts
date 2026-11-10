import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrorDto } from '../../../shared/presentation/error.dto';
import { idempotencyKeyHeader } from '../../../shared/presentation/idempotency.docs';
import { CreditUserBody, RegisterUserBody } from './user.schemas';
import { CreditResponseDto, UserResponseDto } from './user.responses';

export function applyUsersController() {
  return applyDecorators(ApiTags('Users'));
}

export function applyRegisterUser() {
  return applyDecorators(
    ApiOperation({
      summary: 'Register a user',
      description:
        'An initial balance writes the opening credit in the same transaction as the account.',
    }),
    ApiBody({ type: RegisterUserBody }),
    ApiCreatedResponse({ description: 'Account created.', type: UserResponseDto }),
    ApiBadRequestResponse({
      description: 'VALIDATION_ERROR or INVALID_AMOUNT.',
      type: ApiErrorDto,
    }),
    ApiConflictResponse({ description: 'USER_ALREADY_EXISTS.', type: ApiErrorDto }),
  );
}

export function applyGetUser() {
  return applyDecorators(
    ApiOperation({ summary: 'Get a user and balance' }),
    ApiParam({ name: 'id', format: 'uuid', description: 'User id.' }),
    ApiOkResponse({ description: 'Account.', type: UserResponseDto }),
    ApiBadRequestResponse({ description: 'id is not a UUID v4.', type: ApiErrorDto }),
    ApiNotFoundResponse({ description: 'USER_NOT_FOUND.', type: ApiErrorDto }),
  );
}

export function applyCreditUser() {
  return applyDecorators(
    ApiOperation({
      summary: 'Credit a user',
      description: 'Replaying the same idempotency key returns the original credit.',
    }),
    idempotencyKeyHeader,
    ApiParam({ name: 'id', format: 'uuid', description: 'User id.' }),
    ApiBody({ type: CreditUserBody }),
    ApiCreatedResponse({ description: 'Credit recorded.', type: CreditResponseDto }),
    ApiBadRequestResponse({
      description: 'VALIDATION_ERROR, INVALID_AMOUNT, or a missing idempotency key.',
      type: ApiErrorDto,
    }),
    ApiNotFoundResponse({ description: 'USER_NOT_FOUND.', type: ApiErrorDto }),
    ApiConflictResponse({
      description: 'IDEMPOTENCY_KEY_REUSED.',
      type: ApiErrorDto,
    }),
  );
}
