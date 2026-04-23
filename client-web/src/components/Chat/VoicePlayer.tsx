import React, { useRef, useState } from 'react';
import { Play, Pause, X, Loader2, ChevronDown } from 'lucide-react';
import { useVoicePlayer, useVoicePlayerActions } from '@/hooks/useVoicePlayer';
import { Slider } from '@/components/ui/slider';

export const VoicePlayer: React.FC = () => {
	const { track, isPlaying, isLoading, currentTime, duration, speed } =
		useVoicePlayer();
	const { togglePlay, seek, setSpeed, close } = useVoicePlayerActions();
	const progressBarRef = useRef<HTMLDivElement>(null);
	const [showSpeedSlider, setShowSpeedSlider] = useState(false);

	if (!track) return null;

	const progress = duration > 0 ? currentTime / duration : 0;
	const formatTime = (s: number) => {
		if (!isFinite(s) || isNaN(s)) return '0:00';
		return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
	};

	const handleProgressClick = (e: React.MouseEvent) => {
		if (!progressBarRef.current) return;
		const rect = progressBarRef.current.getBoundingClientRect();
		const percent = Math.max(
			0,
			Math.min(1, (e.clientX - rect.left) / rect.width),
		);
		seek(percent);
	};

	return (
		<div
			key={track.fileId}
			className="absolute top-[48px] left-0 right-0 z-20 flex items-center gap-3 px-3 py-1.5 border-b border-border bg-background/95 backdrop-blur-md animate-in slide-in-from-top-1 duration-200"
		>
			{/* Play / Pause */}
			<button
				onClick={togglePlay}
				disabled={isLoading}
				className="w-7 h-7 flex items-center justify-center text-primary hover:bg-primary/10 rounded-full transition shrink-0"
			>
				{isLoading ? (
					<Loader2 size={14} className="animate-spin" />
				) : isPlaying ? (
					<Pause size={14} fill="currentColor" />
				) : (
					<Play size={14} fill="currentColor" className="ml-0.5" />
				)}
			</button>

			{/* Time display */}
			<span className="text-[10px] tabular-nums text-muted-foreground min-w-[70px] shrink-0">
				{formatTime(currentTime)} / {formatTime(duration)}
			</span>

			{/* Progress bar */}
			<div
				ref={progressBarRef}
				className="flex-1 h-1 bg-muted rounded-full cursor-pointer group relative"
				onClick={handleProgressClick}
			>
				{/* Fill */}
				<div
					className="h-full bg-primary/60 rounded-full"
					style={{ width: `${progress * 100}%` }}
				/>
				{/* Thumb */}
				<div
					className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-primary shadow-sm opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1/2"
					style={{ left: `${progress * 100}%` }}
				/>
			</div>

			{/* Speed Control (Vertical Slider) */}
			<div
				className="relative flex items-center shrink-0"
				onMouseEnter={() => setShowSpeedSlider(true)}
				onMouseLeave={() => setShowSpeedSlider(false)}
			>
				<button className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-muted transition-colors">
					<span className="text-[11px] font-bold tabular-nums text-primary min-w-[24px]">
						{speed}×
					</span>
					<ChevronDown
						size={12}
						className={`text-muted-foreground transition-transform duration-200 ${showSpeedSlider ? 'rotate-180' : ''}`}
					/>
				</button>

				{/* Vertical Slider Panel */}
				{showSpeedSlider && (
					<div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 z-50 animate-in fade-in zoom-in-95 duration-150">
						<div className="bg-background/95 backdrop-blur-md border border-border rounded-lg shadow-xl p-3 flex flex-col items-center gap-2 min-h-[120px] w-10">
							<div className="h-24 flex items-center justify-center">
								<Slider
									orientation="vertical"
									min={0.5}
									max={3}
									step={0.1}
									value={[speed]}
									onValueChange={([val]) => setSpeed(val)}
									className="h-full"
								/>
							</div>
						</div>
					</div>
				)}
			</div>

			{/* Close */}
			<button
				onClick={close}
				className="text-muted-foreground hover:text-foreground transition shrink-0 p-1"
				title="Close player"
			>
				<X size={14} />
			</button>
		</div>
	);
};
