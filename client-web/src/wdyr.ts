/// <reference types="@welldone-software/why-did-you-render" />
import React from 'react';
import { isPerfEnabled } from './utils/profiler';

if (import.meta.env.DEV && isPerfEnabled()) {
  const { default: whyDidYouRender } = await import('@welldone-software/why-did-you-render');
  whyDidYouRender(React, {
    trackAllPureComponents: true,
    trackHooks: true,
    logOnDifferentValues: true,
  });
}
