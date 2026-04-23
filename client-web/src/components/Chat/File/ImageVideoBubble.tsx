import React from 'react';
import { ImageIcon, Film, Loader2, Expand, Download, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';

interface ImageVideoBubbleProps {
	meta: any;
	thumbUrl: string | null;
	fullUrl: string | null;
	isDecrypting: boolean;
	progress: number;
	handleDownload: (e?: React.MouseEvent) => void;
	handleFullscreen: (e: React.MouseEvent) => void;
}

export const ImageVideoBubble: React.FC<ImageVideoBubbleProps> = ({
	meta,
	thumbUrl,
	fullUrl,
	isDecrypting,
	progress,
	handleDownload,
	handleFullscreen,
}) => {
	const isVideo = meta.mime.startsWith('video/');
	const isImage = meta.mime.startsWith('image/');

	return (
		<div className="relative rounded-lg overflow-hidden bg-secondary border border-border cursor-pointer hover:border-primary transition group">
			{thumbUrl ? (
				<img
					src={thumbUrl}
					alt="thumbnail"
					className="w-full h-auto max-h-[350px] object-contain block"
				/>
			) : (
				<div className="w-full h-[200px] flex flex-col items-center justify-center text-muted-foreground gap-2 bg-popover">
					{isVideo ? <Film size={48} /> : <ImageIcon size={48} />}
				</div>
			)}

			{isDecrypting && (
				<div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center p-4">
					<Loader2 size={24} className="text-white animate-spin mb-2" />
					<div className="w-full bg-white/20 h-1 rounded-full overflow-hidden">
						<div
							className="bg-primary h-full transition-all"
							style={{ width: `${progress}%` }}
						/>
					</div>
				</div>
			)}

			{!isDecrypting && (
				<div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-4">
					<Dialog.Root
						onOpenChange={(open) => {
							if (open) handleFullscreen({ stopPropagation: () => {} } as any);
						}}
					>
						<Dialog.Trigger asChild>
							<button className="bg-background p-3 rounded-full shadow-2xl hover:scale-110 transition cursor-pointer text-foreground">
								<Expand size={24} />
							</button>
						</Dialog.Trigger>
						<Dialog.Portal>
							<Dialog.Overlay className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100]" />
							<Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-screen h-screen flex flex-col items-center justify-center p-10 focus:outline-none">
								<Dialog.Close asChild>
									<button className="absolute top-6 right-6 text-white/50 hover:text-white transition-all p-2 bg-white/10 rounded-full z-[105] hover:rotate-90">
										<X size={32} />
									</button>
								</Dialog.Close>

								<div className="relative w-full h-full flex flex-col items-center justify-center">
									{fullUrl ? (
										isImage ? (
											<img
												src={fullUrl}
												className="max-w-full max-h-full object-contain"
												alt="fullscreen"
											/>
										) : (
											<video
												src={fullUrl}
												controls
												autoPlay
												className="max-w-full max-h-full"
											/>
										)
									) : (
										<div className="flex flex-col items-center gap-4">
											<Loader2 size={48} className="text-primary animate-spin" />
											<div className="w-48 bg-white/20 h-1 rounded-full">
												<div
													className="bg-primary h-full"
													style={{ width: `${progress}%` }}
												/>
											</div>
										</div>
									)}
									<div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-black/60 px-6 py-3 rounded-full border border-white/10 backdrop-blur-md">
										<div className="text-white text-sm font-medium">
											{meta.name || 'File'} • {(meta.size / 1024).toFixed(1)} KB
										</div>
										<button
											onClick={handleDownload}
											className="text-white bg-primary hover:opacity-90 px-4 py-1.5 rounded font-bold transition flex items-center gap-2"
										>
											<Download size={18} /> Download
										</button>
									</div>
								</div>
							</Dialog.Content>
						</Dialog.Portal>
					</Dialog.Root>

					<button
						onClick={handleDownload}
						className="bg-background p-3 rounded-full shadow-2xl hover:scale-110 transition cursor-pointer text-foreground"
					>
						<Download size={24} />
					</button>
				</div>
			)}
		</div>
	);
};
