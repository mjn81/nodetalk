import React, { useRef } from 'react';
import { Play, Pause, X, Loader2, Mic } from 'lucide-react';
import { useVoicePlayer, useVoicePlayerActions } from '@/hooks/useVoicePlayer';

export const VoicePlayer: React.FC = () => {
	const { track, isPlaying, isLoading, currentTime, duration, speed } = useVoicePlayer();
	const { togglePlay, seek, cycleSpeed, close } = useVoicePlayerActions();
	const progressBarRef = useRef<HTMLDivElement>(null);

	if (!track) return null;

	const progress   = duration > 0 ? currentTime / duration : 0;
	const formatTime = (s: number) => {
		if (!isFinite(s) || isNaN(s)) return '0:00';
		return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
	};

	const handleProgressClick = (e: React.MouseEvent) => {
		if (!progressBarRef.current) return;
		const rect    = progressBarRef.current.getBoundingClientRect();
		const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
		seek(percent);
	};

	return (
		<div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-background/95 backdrop-blur-sm shadow-sm animate-in slide-in-from-top-2 duration-200">
			{/* Mic icon */}
			<div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
				<Mic size={14} className="text-primary" />
			</div>

			{/* Play / Pause */}
			<button
				onClick={togglePlay}
				disabled={isLoading}
				className="w-8 h-8 flex items-center justify-center bg-primary text-primary-foreground rounded-full hover:scale-105 active:scale-95 transition shrink-0"
			>
				{isLoading
					? <Loader2 size={16} className="animate-spin" />
					: isPlaying
						? <Pause size={16} fill="currentColor" />
						: <Play  size={16} fill="currentColor" className="ml-0.5" />
				}
			</button>

			{/* Time display */}
			<span className="text-[11px] tabular-nums text-muted-foreground w-20 shrink-0">
				{formatTime(currentTime)} / {formatTime(duration)}
			</span>

			{/* Progress bar */}
			<div
				ref={progressBarRef}
				className="flex-1 h-1.5 bg-muted rounded-full cursor-pointer group relative"
				onClick={handleProgressClick}
			>
				{/* Fill */}
				<div
					className="h-full bg-primary rounded-full"
					style={{ width: `${progress * 100}%` }}
				/>
				{/* Thumb — positioned relative to the track, not the fill */}
				<div
					className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary shadow-md opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1/2"
					style={{ left: `${progress * 100}%` }}
				/>
			</div>

			{/* Speed button */}
			<button
				onClick={cycleSpeed}
				className="text-[11px] font-bold tabular-nums text-muted-foreground hover:text-foreground transition px-1.5 py-0.5 rounded hover:bg-muted shrink-0 min-w-[36px] text-center"
				title="Playback speed"
			>
				{speed}×
			</button>

			{/* Close */}
			<button
				onClick={close}
				className="text-muted-foreground hover:text-foreground transition shrink-0"
				title="Close player"
			>
				<X size={18} />
			</button>
		</div>
	);
};
