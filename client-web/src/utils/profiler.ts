import type { ProfilerOnRenderCallback } from 'react';

/**
 * Toggle this to enable/disable all profiling logs and overlays.
 * Can be controlled via localStorage.setItem('PERF_DEBUG', 'true')
 */
const IS_PERF_ENABLED = 
  import.meta.env.DEV && 
  (typeof window !== 'undefined' && localStorage.getItem('PERF_DEBUG') === 'true');

/**
 * Custom profiler callback to log rendering durations.
 * Only logs updates that take longer than the threshold to avoid noise.
 */
export const logProfiler: ProfilerOnRenderCallback = (
  id,
  phase,
  actualDuration,
  baseDuration,
) => {
  if (!IS_PERF_ENABLED) return;

  const threshold = 3; // ms
  if (actualDuration > threshold) {
    console.log(
      `%c[Profiler] ${id} (${phase}) took ${actualDuration.toFixed(2)}ms (base: ${baseDuration.toFixed(2)}ms)`,
      'color: #00ff00; font-weight: bold;'
    );
  }
};

export const isPerfEnabled = () => IS_PERF_ENABLED;
