/**
 * Detects if the application is running within the Wails desktop environment.
 */
export const isWails = (): boolean => {
	return typeof (window as any).go?.main?.App !== 'undefined';
};

/**
 * Detects if the application is running in a standard web browser (non-Wails).
 */
export const isBrowser = (): boolean => {
	return !isWails();
};
