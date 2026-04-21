// logger.ts
// Simple client‑only logger with colors + timestamps

type LogLevels = 'debug' | 'info' | 'warn' | 'error';

interface LogData {
	[key: string]: unknown;
}

const COLORS: Record<LogLevels, string> = {
	debug: 'color: #9CA3AF', // gray
	info: 'color: #3B82F6', // blue
	warn: 'color: #EAB308', // yellow
	error: 'color: #EF4444', // red
};

function timestamp() {
	return new Date().toISOString();
}

function format(level: LogLevels, message: string) {
	return [
		`%c[${level.toUpperCase()}]`,
		COLORS[level],
		`%c${timestamp()}`,
		'color: #6B7280',
		`%c${message}`,
		'color: inherit',
	];
}

function print(level: LogLevels, message: string, data?: LogData) {
	const args = format(level, message);

	if (data) {
		console[level](...args, data);
	} else {
		console[level](...args);
	}
}

export const logger = {
	debug(message: string, data?: LogData) {
		print('debug', message, data);
	},
	info(message: string, data?: LogData) {
		print('info', message, data);
	},
	warn(message: string, data?: LogData) {
		print('warn', message, data);
	},
	error(message: string, data?: LogData) {
		print('error', message, data);
	},
};
