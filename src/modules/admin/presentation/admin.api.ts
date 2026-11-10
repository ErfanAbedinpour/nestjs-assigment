import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiErrorDto } from '../../../shared/presentation/error.dto';
import {
  AdminTransactionPageDto,
  AdminUserPageDto,
  AdminUserResponseDto,
  BalanceUsageResponseDto,
  TransactionSummaryResponseDto,
} from './admin.responses';

const userId = ApiParam({ name: 'id', format: 'uuid', description: 'User id.' });
const pageQuery = ApiQuery({
  name: 'page',
  required: false,
  type: Number,
  schema: { type: 'integer', minimum: 1, default: 1 },
});
const pageSizeQuery = ApiQuery({
  name: 'pageSize',
  required: false,
  type: Number,
  schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
});

export function applyAdminController() {
  return applyDecorators(
    ApiTags('Admin'),
    ApiSecurity('admin-api-key'),
    ApiUnauthorizedResponse({
      description: 'Missing or wrong X-Admin-Api-Key.',
      type: ApiErrorDto,
    }),
  );
}

export function applyListUsers() {
  return applyDecorators(
    ApiOperation({ summary: 'List users and balances' }),
    pageQuery,
    pageSizeQuery,
    ApiOkResponse({ description: 'Page of accounts.', type: AdminUserPageDto }),
    ApiBadRequestResponse({ description: 'VALIDATION_ERROR.', type: ApiErrorDto }),
  );
}

export function applyAdminUser() {
  return applyDecorators(
    ApiOperation({ summary: 'Get one user' }),
    userId,
    ApiOkResponse({ description: 'Account.', type: AdminUserResponseDto }),
    ApiBadRequestResponse({ description: 'id is not a UUID v4.', type: ApiErrorDto }),
    ApiNotFoundResponse({ description: 'USER_NOT_FOUND.', type: ApiErrorDto }),
  );
}

export function applyUserTransactions() {
  return applyDecorators(
    ApiOperation({ summary: 'List a user ledger' }),
    userId,
    pageQuery,
    pageSizeQuery,
    ApiOkResponse({
      description: 'Page of ledger entries.',
      type: AdminTransactionPageDto,
    }),
    ApiBadRequestResponse({ description: 'VALIDATION_ERROR.', type: ApiErrorDto }),
    ApiNotFoundResponse({ description: 'USER_NOT_FOUND.', type: ApiErrorDto }),
  );
}

export function applyTransactionSummary() {
  return applyDecorators(
    ApiOperation({
      summary: 'Summarize credits and debits',
      description:
        '`from` is inclusive and `to` is exclusive. The range cannot exceed 10 years.',
    }),
    ApiQuery({
      name: 'period',
      required: true,
      enum: ['daily', 'monthly', 'yearly'],
    }),
    ApiQuery({ name: 'from', required: true, type: String, schema: { format: 'date-time' } }),
    ApiQuery({ name: 'to', required: true, type: String, schema: { format: 'date-time' } }),
    ApiOkResponse({ description: 'Totals by period.', type: TransactionSummaryResponseDto }),
    ApiBadRequestResponse({
      description: 'VALIDATION_ERROR or INVALID_REPORT_RANGE.',
      type: ApiErrorDto,
    }),
  );
}

export function applyBalanceUsage() {
  return applyDecorators(
    ApiOperation({ summary: 'Balance usage per user' }),
    ApiOkResponse({
      description: 'Credits, debits, and balance.',
      type: BalanceUsageResponseDto,
    }),
  );
}
