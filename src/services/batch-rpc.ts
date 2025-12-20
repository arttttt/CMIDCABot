/**
 * Batch RPC Client
 *
 * Implements JSON-RPC 2.0 batch requests for Solana RPC.
 * Combines multiple RPC calls into a single HTTP request to reduce:
 * - RPC billing (paid providers charge per request)
 * - Rate limit consumption
 * - Network overhead
 *
 * @see https://www.jsonrpc.org/specification#batch
 */

import { logger } from "./logger.js";

/**
 * JSON-RPC 2.0 request structure
 */
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params: unknown[];
}

/**
 * JSON-RPC 2.0 response structure (success)
 */
export interface JsonRpcSuccessResponse<T = unknown> {
  jsonrpc: "2.0";
  id: number;
  result: T;
}

/**
 * JSON-RPC 2.0 error object
 */
export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * JSON-RPC 2.0 response structure (error)
 */
export interface JsonRpcErrorResponse {
  jsonrpc: "2.0";
  id: number;
  error: JsonRpcError;
}

/**
 * JSON-RPC 2.0 response (success or error)
 */
export type JsonRpcResponse<T = unknown> = JsonRpcSuccessResponse<T> | JsonRpcErrorResponse;

/**
 * RPC call definition for batch
 */
export interface RpcCall {
  method: string;
  params: unknown[];
}

/**
 * Result of a single RPC call in batch (success or error)
 */
export type BatchResult<T> =
  | { success: true; value: T }
  | { success: false; error: JsonRpcError };

/**
 * Check if response is an error
 */
function isErrorResponse(response: JsonRpcResponse): response is JsonRpcErrorResponse {
  return "error" in response;
}

/**
 * Check if an error is a rate limit error (HTTP 429)
 */
function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes("429") || error.message.includes("Too Many Requests");
  }
  return false;
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Batch RPC Client for Solana
 *
 * Sends multiple RPC calls in a single HTTP request using JSON-RPC 2.0 batch format.
 */
export class BatchRpcClient {
  constructor(private rpcUrl: string) {}

  /**
   * Execute multiple RPC calls in a single batch request.
   *
   * @param calls - Array of RPC calls to execute
   * @param maxRetries - Maximum retry attempts on rate limit (default 3)
   * @param baseDelayMs - Base delay for exponential backoff (default 1000ms)
   * @returns Array of results in the same order as input calls
   *
   * @example
   * ```typescript
   * const results = await client.batch([
   *   { method: "getBalance", params: [address] },
   *   { method: "getTokenAccountsByOwner", params: [address, { mint }, { encoding: "jsonParsed" }] },
   * ]);
   * ```
   */
  async batch<T extends unknown[]>(
    calls: RpcCall[],
    maxRetries: number = 3,
    baseDelayMs: number = 1000,
  ): Promise<{ [K in keyof T]: BatchResult<T[K]> }> {
    if (calls.length === 0) {
      return [] as { [K in keyof T]: BatchResult<T[K]> };
    }

    // Build JSON-RPC 2.0 batch request
    const requests: JsonRpcRequest[] = calls.map((call, index) => ({
      jsonrpc: "2.0" as const,
      id: index,
      method: call.method,
      params: call.params,
    }));

    // Execute with retry logic
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const startTime = Date.now();

        const response = await fetch(this.rpcUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requests),
        });

        const duration = Date.now() - startTime;

        // Handle HTTP errors
        if (!response.ok) {
          const errorText = await response.text().catch(() => "");

          // Rate limit - retry with backoff
          if (response.status === 429) {
            throw new Error(`Rate limited: ${response.status} ${errorText}`);
          }

          throw new Error(`Batch RPC HTTP error: ${response.status} ${errorText}`);
        }

        const responses = (await response.json()) as JsonRpcResponse[];

        logger.debug("BatchRPC", "Batch request completed", {
          calls: calls.length,
          duration: `${duration}ms`,
        });

        // Map responses back to input order using id field
        // Note: JSON-RPC 2.0 spec allows responses in any order
        const resultsMap = new Map<number, JsonRpcResponse>();
        for (const resp of responses) {
          resultsMap.set(resp.id, resp);
        }

        // Build results array in original order
        const results: BatchResult<unknown>[] = [];

        for (let i = 0; i < calls.length; i++) {
          const resp = resultsMap.get(i);

          if (!resp) {
            // Missing response - treat as error
            results.push({
              success: false,
              error: {
                code: -32603,
                message: `No response for request id ${i}`,
              },
            });
            continue;
          }

          if (isErrorResponse(resp)) {
            results.push({
              success: false,
              error: resp.error,
            });
          } else {
            results.push({
              success: true,
              value: resp.result,
            });
          }
        }

        return results as { [K in keyof T]: BatchResult<T[K]> };
      } catch (error) {
        lastError = error;

        // Only retry on rate limit errors
        if (!isRateLimitError(error) || attempt === maxRetries) {
          throw error;
        }

        // Exponential backoff: 1s, 2s, 4s
        const delayMs = baseDelayMs * Math.pow(2, attempt);
        logger.debug("BatchRPC", "Rate limited, retrying", {
          attempt: attempt + 1,
          maxRetries,
          delayMs,
        });
        await sleep(delayMs);
      }
    }

    throw lastError;
  }
}
