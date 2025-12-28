/**
 * Stream utilities for ClientResponseStream
 *
 * Helper functions for working with async generator streams.
 */

import type { ClientResponseStream, StreamItem, ClientResponse } from "../types.js";

/**
 * Transform each item in stream
 */
export async function* mapStream(
  stream: ClientResponseStream,
  fn: (item: StreamItem) => StreamItem,
): ClientResponseStream {
  for await (const item of stream) {
    yield fn(item);
  }
}

/**
 * Wrap stream with error handling
 *
 * Catches both:
 * - Sync errors during stream creation
 * - Async errors during iteration
 *
 * @param factory - Function that creates the stream (allows catching sync errors)
 * @param onError - Error handler that returns a response
 */
export async function* catchStream(
  factory: () => ClientResponseStream,
  onError: (error: unknown) => ClientResponse,
): ClientResponseStream {
  let stream: ClientResponseStream;
  try {
    stream = factory();
  } catch (error) {
    yield { response: onError(error), mode: "final" };
    return;
  }

  try {
    for await (const item of stream) {
      yield item;
    }
  } catch (error) {
    yield { response: onError(error), mode: "final" };
  }
}

/**
 * Wrap single response as final stream
 *
 * Convenience helper for returning simple responses.
 */
export function final(response: ClientResponse): ClientResponseStream {
  async function* gen(): ClientResponseStream {
    yield { response, mode: "final" };
  }
  return gen();
}
