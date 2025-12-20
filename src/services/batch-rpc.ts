/**
 * Batch RPC Client
 *
 * Implements JSON-RPC 2.0 batch requests for Solana RPC.
 * Combines multiple RPC calls into a single HTTP request to reduce:
 * - RPC billing (paid providers charge per request)
 * - Rate limit consumption
 * - Network overhead
 *
 * Supports selective retry: if some calls fail, only failed calls are retried.
 *
 * @see https://www.jsonrpc.org/specification#batch
 */

import { logger } from "./logger.js";
import { withRetry } from "./retry.js";

/**
 * JSON-RPC 2.0 request structure
 */
interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params: unknown[];
}

/**
 * JSON-RPC 2.0 response structure (success)
 */
interface JsonRpcSuccessResponse<T = unknown> {
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
interface JsonRpcErrorResponse {
  jsonrpc: "2.0";
  id: number;
  error: JsonRpcError;
}

/**
 * JSON-RPC 2.0 response (success or error)
 */
type JsonRpcResponse<T = unknown> = JsonRpcSuccessResponse<T> | JsonRpcErrorResponse;

/**
 * RPC call definition for batch
 */
export interface RpcCall {
  method: string;
  params: unknown[];
}

/**
 * Result of a single call in batch
 */
export type BatchCallResult<T> =
  | { success: true; value: T }
  | { success: false; error: JsonRpcError };

/**
 * Check if response is an error
 */
function isErrorResponse(response: JsonRpcResponse): response is JsonRpcErrorResponse {
  return "error" in response;
}

/**
 * Batch RPC Client for Solana
 *
 * Sends multiple RPC calls in a single HTTP request using JSON-RPC 2.0 batch format.
 * Supports selective retry for failed calls.
 */
export class BatchRpcClient {
  constructor(private rpcUrl: string) {}

  /**
   * Execute multiple RPC calls in a single batch request with selective retry.
   *
   * Strategy:
   * 1. Execute all calls in one batch
   * 2. If some fail, retry only failed calls
   * 3. Merge results
   * 4. If still failures after retry, throw error
   *
   * @param calls - Array of RPC calls to execute
   * @param maxRetries - Maximum retries for failed calls (default 2)
   * @returns Array of results in the same order as input calls
   * @throws Error if any call still fails after retries
   */
  async batch<T extends unknown[]>(
    calls: RpcCall[],
    maxRetries: number = 2,
  ): Promise<T> {
    if (calls.length === 0) {
      return [] as unknown as T;
    }

    // Execute initial batch
    let results = await this.executeBatch(calls);

    // Retry failed calls
    for (let retry = 0; retry < maxRetries; retry++) {
      const failedIndices = this.getFailedIndices(results);

      if (failedIndices.length === 0) {
        break; // All succeeded
      }

      logger.debug("BatchRPC", "Retrying failed calls", {
        retry: retry + 1,
        maxRetries,
        failedCount: failedIndices.length,
        failedMethods: failedIndices.map(i => calls[i].method),
      });

      // Build retry batch with only failed calls
      const retryCalls = failedIndices.map(i => calls[i]);
      const retryResults = await this.executeBatch(retryCalls);

      // Merge retry results back
      results = this.mergeResults(results, failedIndices, retryResults);
    }

    // Check for remaining failures
    const remainingFailures = this.getFailedIndices(results);
    if (remainingFailures.length > 0) {
      const failedMethods = remainingFailures.map(i => {
        const result = results[i];
        const method = calls[i].method;
        if (!result.success) {
          return `${method}: [${result.error.code}] ${result.error.message}`;
        }
        return method;
      });

      throw new Error(`Batch RPC failed after ${maxRetries} retries: ${failedMethods.join(", ")}`);
    }

    // Extract values from successful results
    return results.map(r => {
      if (!r.success) {
        throw new Error("Unexpected failure after retry check");
      }
      return r.value;
    }) as T;
  }

  /**
   * Execute a single batch request (no retry logic).
   * Returns results with success/error information for each call.
   */
  private async executeBatch(calls: RpcCall[]): Promise<BatchCallResult<unknown>[]> {
    // Build JSON-RPC 2.0 batch request
    const requests: JsonRpcRequest[] = calls.map((call, index) => ({
      jsonrpc: "2.0" as const,
      id: index,
      method: call.method,
      params: call.params,
    }));

    // Execute with retry on HTTP-level errors (rate limit)
    return withRetry(async () => {
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
        throw new Error(`Batch RPC HTTP error: ${response.status} ${errorText}`);
      }

      const responses = (await response.json()) as JsonRpcResponse[];

      logger.debug("BatchRPC", "Batch executed", {
        calls: calls.length,
        duration: `${duration}ms`,
      });

      // Map responses back to input order using id field
      const resultsMap = new Map<number, JsonRpcResponse>();
      for (const resp of responses) {
        resultsMap.set(resp.id, resp);
      }

      // Build results array in original order
      const results: BatchCallResult<unknown>[] = [];

      for (let i = 0; i < calls.length; i++) {
        const resp = resultsMap.get(i);

        if (!resp) {
          results.push({
            success: false,
            error: {
              code: -32603,
              message: `Missing response for request ${i} (${calls[i].method})`,
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

      return results;
    });
  }

  /**
   * Get indices of failed calls
   */
  private getFailedIndices(results: BatchCallResult<unknown>[]): number[] {
    return results
      .map((r, i) => (!r.success ? i : -1))
      .filter(i => i !== -1);
  }

  /**
   * Merge retry results back into original results array
   */
  private mergeResults(
    original: BatchCallResult<unknown>[],
    failedIndices: number[],
    retryResults: BatchCallResult<unknown>[],
  ): BatchCallResult<unknown>[] {
    const merged = [...original];

    for (let i = 0; i < failedIndices.length; i++) {
      merged[failedIndices[i]] = retryResults[i];
    }

    return merged;
  }
}
