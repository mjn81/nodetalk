import { useState, useRef, useEffect } from 'react';
import { Mic, Trash2, Send } from 'lucide-react';

interface VoiceRecorderProps {
	channelId: string;
	onFile: (file: File) => void;
	size?: number;
}

export default function VoiceRecorder({ onFile, size = 24 }: VoiceRecorderProps) {
	const [isRecording, setIsRecording] = useState(false);
	const [duration, setDuration] = useState(0);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const chunksRef = useRef<Blob[]>([]);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const isDiscardingRef = useRef(false);


	const startRecording = async () => {
		try {
			// On macOS Wails, we sometimes need to explicitly trigger the system permission dialog
			// via the native Go backend because the WebView might not do it automatically.
			const wails = (window as any).go?.main?.App;
			if (wails?.RequestMicrophonePermission) {
				await wails.RequestMicrophonePermission();
			}

			if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
				throw new Error('Your browser or environment does not support microphone access (possibly due to insecure context or missing permissions).');
			}
			const preferredMicId = localStorage.getItem('preferred-mic-id');
			const constraints: MediaStreamConstraints = {
				audio: preferredMicId && preferredMicId !== 'default' 
					? { deviceId: { exact: preferredMicId } } 
					: true
			};

			const stream = await navigator.mediaDevices.getUserMedia(constraints);

			// Find supported mime type - expand for Safari/WebKit compatibility
			const mimeType = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/aac'].find((type) =>
				MediaRecorder.isTypeSupported(type),
			);


			const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
			mediaRecorderRef.current = recorder;
			chunksRef.current = [];
			isDiscardingRef.current = false;


			recorder.ondataavailable = (e) => {
				if (e.data.size > 0) chunksRef.current.push(e.data);
			};

			recorder.onstop = () => {
				if (isDiscardingRef.current) {
					stream.getTracks().forEach((track) => track.stop());
					return;
				}

				const mimeType = recorder.mimeType || 'audio/webm';
				const blob = new Blob(chunksRef.current, { type: mimeType });
				const ext = mimeType.includes('ogg') ? 'ogg' : 'webm';
				const file = new File([blob], `voice-note-${Date.now()}.${ext}`, {
					type: mimeType,
				});
				if (chunksRef.current.length > 0) {
					onFile(file);
				}
				stream.getTracks().forEach((track) => track.stop());
			};

			recorder.start();
			setIsRecording(true);
			setDuration(0);
			timerRef.current = setInterval(() => {
				setDuration((prev) => prev + 1);
			}, 1000);
		} catch (err: any) {
			console.error('Failed to start recording:', err);
			alert(`Microphone error: ${err.message || 'Unknown error'}. Please check permissions.`);
		}
	};

	const stopRecording = (shouldSave: boolean) => {
		if (mediaRecorderRef.current && isRecording) {
			isDiscardingRef.current = !shouldSave;
			if (!shouldSave) {
				chunksRef.current = [];
			}
			mediaRecorderRef.current.stop();

			setIsRecording(false);
			if (timerRef.current) clearInterval(timerRef.current);
		}
	};

	useEffect(() => {
		return () => {
			if (timerRef.current) clearInterval(timerRef.current);
		};
	}, []);

	const formatDuration = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	};

	if (isRecording) {
		return (
			<div className="flex items-center gap-2 bg-secondary px-3 py-1 rounded-full animate-in fade-in zoom-in-95 duration-200 shadow-sm border border-primary/20">
				<div className="flex items-center gap-2 mr-2">
					<div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
					<span className="text-xs font-bold text-foreground tabular-nums">
						{formatDuration(duration)}
					</span>
				</div>
				<button
					onClick={() => stopRecording(false)}
					className="text-muted-foreground hover:text-destructive transition-colors p-1"
					title="Discard"
				>
					<Trash2 size={18} />
				</button>
				<button
					onClick={() => stopRecording(true)}
					className="text-primary hover:text-primary/80 transition-colors p-1"
					title="Send Voice Note"
				>
					<Send size={18} />
				</button>
			</div>
		);
	}

	return (
		<button
			onClick={startRecording}
			className="text-muted-foreground hover:text-foreground transition-colors p-1"
			title="Record Voice Note"
		>
			<Mic size={size} />
		</button>
	);
}
