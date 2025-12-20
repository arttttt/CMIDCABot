/**
 * OperationState - Generic type for streaming operation progress
 *
 * Inspired by Kotlin sealed interfaces, this discriminated union
 * represents either progress updates or final completion.
 *
 * Usage with AsyncGenerator:
 *   async function* execute(): AsyncGenerator<OperationState<StepType, ResultType>>
 */

/**
 * Generic operation state - progress or completed
 */
export type OperationState<TStep, TResult> =
  | { type: "progress"; step: TStep }
  | { type: "completed"; result: TResult };

/**
 * Helper to create progress state
 */
export function progress<TStep>(step: TStep): OperationState<TStep, never> {
  return { type: "progress", step };
}

/**
 * Helper to create completed state
 */
export function completed<TResult>(result: TResult): OperationState<never, TResult> {
  return { type: "completed", result };
}
