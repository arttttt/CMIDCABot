/**
 * IntervalRunner - shared setInterval lifecycle for periodic tasks
 *
 * Owns the timer plumbing every scheduler otherwise repeats:
 * unref'd interval, task error isolation, idempotent start/stop.
 */

export class IntervalRunner {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly task: () => Promise<void> | void,
    private readonly intervalMs: number,
    private readonly onError: (error: unknown) => void,
  ) {}

  /**
   * Start the interval; optionally run the task once immediately.
   */
  start(options: { immediate?: boolean } = {}): void {
    if (this.timer) return;

    if (options.immediate) {
      void this.runSafely();
    }

    this.timer = setInterval(() => {
      void this.runSafely();
    }, this.intervalMs);

    // Don't prevent process exit
    this.timer.unref();
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  private async runSafely(): Promise<void> {
    try {
      await this.task();
    } catch (error) {
      this.onError(error);
    }
  }
}
