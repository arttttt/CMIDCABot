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
interface JsonRpcError {
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
 * Check if response is an error
 */
function isErrorResponse(response: JsonRpcResponse): response is JsonRpcErrorResponse {
  return "error" in response;
}

/**
 * Batch RPC Client for Solana
 *
 * Sends multiple RPC calls in a single HTTP request using JSON-RPC 2.0 batch format.
 * All calls must succeed — if any call fails, the entire batch throws an error.
 */
export class BatchRpcClient {
  constructor(private rpcUrl: string) {}

  /**
   * Execute multiple RPC calls in a single batch request.
   *
   * @param calls - Array of RPC calls to execute
   * @returns Array of results in the same order as input calls
   * @throws Error if HTTP request fails or any RPC call in batch returns an error
   *
   * @example
   * ```typescript
   * const [balance, tokenAccounts] = await client.batch<[
   *   { value: bigint },
   *   { value: TokenAccount[] }
   * ]>([
   *   { method: "getBalance", params: [address] },
   *   { method: "getTokenAccountsByOwner", params: [address, { mint }, { encoding: "jsonParsed" }] },
   * ]);
   * ```
   */
  async batch<T extends unknown[]>(calls: RpcCall[]): Promise<T> {
    if (calls.length === 0) {
      return [] as unknown as T;
    }

    // Build JSON-RPC 2.0 batch request
    const requests: JsonRpcRequest[] = calls.map((call, index) => ({
      jsonrpc: "2.0" as const,
      id: index,
      method: call.method,
      params: call.params,
    }));

    // Execute with retry on rate limit
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

      // Build results array in original order, fail on any error
      const results: unknown[] = [];

      for (let i = 0; i < calls.length; i++) {
        const resp = resultsMap.get(i);

        if (!resp) {
          throw new Error(
            `Batch RPC: missing response for request ${i} (${calls[i].method})`
          );
        }

        if (isErrorResponse(resp)) {
          throw new Error(
            `Batch RPC: ${calls[i].method} failed: [${resp.error.code}] ${resp.error.message}`
          );
        }

        results.push(resp.result);
      }

      return results as T;
    });
  }
}
