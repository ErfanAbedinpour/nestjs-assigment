import { randomUUID } from 'node:crypto';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9-]{1,100}$/;

type HeaderValue = string | string[] | undefined;

type RequestWithId = {
  headers: Record<string, HeaderValue>;
  requestId?: string;
};

type ResponseWithHeader = {
  setHeader: (name: string, value: string) => void;
};

/**
 * Accepts a caller-supplied request id only when it is safe to echo back.
 * Anything else is replaced so the response header cannot carry injected content.
 */
export function requestContextMiddleware(
  request: RequestWithId,
  response: ResponseWithHeader,
  next: () => void,
): void {
  const header = request.headers['x-request-id'];
  const incoming = Array.isArray(header) ? header[0] : header;
  const requestId =
    incoming !== undefined && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();
  request.requestId = requestId;
  response.setHeader('x-request-id', requestId);
  next();
}
