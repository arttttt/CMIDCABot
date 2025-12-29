/**
 * Stream utilities for ClientResponseStream
 *
 * Static methods for working with async generator streams.
 */

import type { ClientResponseStream, StreamItem, ClientResponse } from "../types.js";

export class StreamUtils {
  /**
   * Transform each item in stream
   */
  static async *map(
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
  static async *catch(
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
   * Wrap stream with error handling (async factory version)
   *
   * Like catch(), but accepts an async factory that returns Promise<ClientResponseStream>.
   * Use this when wrapping handler chains where each handler returns Promise.
   *
   * @param factory - Async function that creates the stream
   * @param onError - Error handler that returns a response
   */
  static async *catchAsync(
    factory: () => Promise<ClientResponseStream>,
    onError: (error: unknown) => ClientResponse,
  ): ClientResponseStream {
    let stream: ClientResponseStream;
    try {
      stream = await factory();
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
  static final(response: ClientResponse): ClientResponseStream {
    async function* gen(): ClientResponseStream {
      yield { response, mode: "final" };
    }
    return gen();
  }
}
