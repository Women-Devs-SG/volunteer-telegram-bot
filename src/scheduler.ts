// No-op scheduler: automatic scheduling is intentionally disabled across the codebase
export class VolunteerScheduler {
  // start() and stop() exist for compatibility but perform no actions
  start(): void {
    console.log('📅 Scheduler is disabled by design; no automatic tasks will run.');
  }

  stop(): void {
    // nothing to stop
  }

  // Manual run is not supported anymore; retained for API compatibility
  async runManual(): Promise<string> {
    return 'Scheduler disabled; no monthly processing available.';
  }
}
