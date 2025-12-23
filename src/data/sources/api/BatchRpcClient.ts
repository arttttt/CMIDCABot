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

import { logger } from "../../../infrastructure/shared/logging/index.js";
import { withRetry, isRateLimitError } from "../../../infrastructure/shared/resilience/index.js";

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
   * Uses withRetry for the retry loop with custom shouldRetry logic.
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

    // Track results across retries
    let results: BatchCallResult<unknown>[] | null = null;

    // Use withRetry with custom shouldRetry: retry if there are failed calls
    await withRetry(
      async () => {
        // Determine which calls to execute
        const failedIndices = results ? this.getFailedIndices(results) : null;
        const callsToExecute = failedIndices
          ? failedIndices.map(i => calls[i])
          : calls;

        if (failedIndices) {
          logger.debug("BatchRPC", "Retrying failed calls", {
            failedCount: failedIndices.length,
            failedMethods: failedIndices.map(i => calls[i].method),
          });
        }

        // Execute batch
        const batchResults = await this.executeBatch(callsToExecute);

        // Merge results or initialize
        if (results && failedIndices) {
          results = this.mergeResults(results, failedIndices, batchResults);
        } else {
          results = batchResults;
        }

        // Check for failures — throw to trigger retry
        const remainingFailures = this.getFailedIndices(results);
        if (remainingFailures.length > 0) {
          const error = new Error("Batch has failed calls");
          (error as BatchRetryError).isBatchRetry = true;
          throw error;
        }
      },
      maxRetries,
      500, // Shorter delay for RPC retries
      (error) => {
        // Retry on rate limit (HTTP 429) or batch partial failure
        return isRateLimitError(error) || (error as BatchRetryError).isBatchRetry === true;
      },
    );

    // Extract values from successful results
    return results!.map(r => {
      if (!r.success) {
        // This shouldn't happen after withRetry completes without throwing
        throw new Error(`Batch RPC failed: [${r.error.code}] ${r.error.message}`);
      }
      return r.value;
    }) as T;
  }

  /**
   * Execute a single batch HTTP request.
   * Returns results with success/error information for each call.
   */
  private async executeBatch(calls: RpcCall[]): Promise<BatchCallResult<unknown>[]> {
    const requests: JsonRpcRequest[] = calls.map((call, index) => ({
      jsonrpc: "2.0" as const,
      id: index,
      method: call.method,
      params: call.params,
    }));

    const startTime = Date.now();

    const response = await fetch(this.rpcUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requests),
    });

    const duration = Date.now() - startTime;

    // Handle HTTP errors — throw to trigger withRetry
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
    const resultsArray: BatchCallResult<unknown>[] = [];

    for (let i = 0; i < calls.length; i++) {
      const resp = resultsMap.get(i);

      if (!resp) {
        resultsArray.push({
          success: false,
          error: {
            code: -32603,
            message: `Missing response for request ${i} (${calls[i].method})`,
          },
        });
        continue;
      }

      if (isErrorResponse(resp)) {
        resultsArray.push({
          success: false,
          error: resp.error,
        });
      } else {
        resultsArray.push({
          success: true,
          value: resp.result,
        });
      }
    }

    return resultsArray;
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

/**
 * Internal error type for batch retry signaling
 */
interface BatchRetryError extends Error {
  isBatchRetry?: boolean;
}
