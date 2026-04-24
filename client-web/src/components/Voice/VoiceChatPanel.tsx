import React from 'react';
import { Mic, MicOff, Volume2, VolumeX, PhoneOff, Maximize2, Minimize2 } from 'lucide-react';
import { Avatar } from '../Avatar';

interface VoiceChatPanelProps {
	isActive: boolean;
	isMuted: boolean;
	isDeafened: boolean;
	speakingUsers: Set<string>;
	onMuteToggle: () => void;
	onDeafenToggle: () => void;
	onDisconnect: () => void;
	members: string[]; // Active Participant User IDs
	memberAvatars: Record<string, string>;
	memberNames: Record<string, string>;
}

export const VoiceChatPanel: React.FC<VoiceChatPanelProps> = ({
	isActive,
	isMuted,
	isDeafened,
	speakingUsers,
	onMuteToggle,
	onDeafenToggle,
	onDisconnect,
	members,
	memberAvatars,
	memberNames,
}) => {
	const [isExpanded, setIsExpanded] = React.useState(false);

	if (!isActive) return null;

	// Grid layout logic
	const gridCols = members.length <= 1 ? 'grid-cols-1' : members.length <= 4 ? 'grid-cols-2' : 'grid-cols-3';

	return (
		<div className={`fixed transition-all duration-300 ease-in-out z-50 flex flex-col bg-card border border-border shadow-2xl overflow-hidden
			${isExpanded 
				? 'inset-6 rounded-xl' 
				: 'bottom-6 right-6 w-[340px] h-[520px] rounded-xl'
			}`}
		>
			{/* Header */}
			<div className="px-4 py-3 flex items-center justify-between border-b border-border bg-muted/30">
				<div className="flex items-center gap-2">
					<div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
						<div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
						<span className="text-[10px] font-bold text-primary uppercase tracking-wider">Live</span>
					</div>
					<h3 className="text-xs font-semibold text-foreground/80">{members.length} Connected</h3>
				</div>
				<div className="flex items-center gap-1">
					<button 
						onClick={() => setIsExpanded(!isExpanded)}
						className="p-1.5 hover:bg-muted rounded transition-colors text-muted-foreground hover:text-foreground"
					>
						{isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
					</button>
					<button 
						onClick={onDisconnect}
						className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded transition-colors"
					>
						<PhoneOff size={16} />
					</button>
				</div>
			</div>

			{/* Participants Grid */}
			<div className={`flex-1 overflow-y-auto bg-background/50 ${isExpanded ? 'p-6' : 'p-3'}`}>
				<div className={`grid gap-3 ${gridCols} ${isExpanded ? 'h-auto' : 'min-h-[160px]'}`}>
					{members.map(userId => {
						const isSpeaking = speakingUsers.has(userId);
						return (
							<div 
								key={userId} 
								className={`relative flex flex-col items-center justify-center rounded-lg border transition-all duration-200 py-4 ${
									isSpeaking 
										? 'border-primary ring-1 ring-primary/20 shadow-lg shadow-primary/5' 
										: 'bg-muted/20 border-border/50 hover:border-border'
								}`}
							>
								<div className="relative">
									<Avatar 
										userId={userId} 
										avatarId={memberAvatars[userId]} 
										size={isExpanded ? 96 : 56} 
									/>
									{isSpeaking && (
										<div className="absolute -inset-1 rounded-full border-2 border-primary shadow-[0_0_10px_theme(colors.primary.DEFAULT/40%)] animate-pulse" />
									)}
								</div>
								<div className="mt-2.5 px-2 w-full text-center">
									<span className={`text-[11px] font-bold truncate block ${isSpeaking ? 'text-primary' : 'text-foreground/70'}`}>
										{memberNames[userId] || `User ${userId.slice(0, 8)}`}
									</span>
								</div>
							</div>
						);
					})}
				</div>
			</div>

			{/* Controls Footer */}
			<div className="px-4 py-4 bg-muted/20 border-t border-border flex items-center justify-center gap-4">
				<button
					onClick={onMuteToggle}
					className={`flex items-center justify-center w-12 h-12 rounded-lg border transition-all duration-200
						${isMuted 
							? 'bg-destructive/10 border-destructive/50 text-destructive' 
							: 'bg-background border-border text-foreground hover:bg-muted hover:border-border-hover shadow-sm'}`}
				>
					{isMuted ? <MicOff size={20} /> : <Mic size={20} />}
				</button>
				<button
					onClick={onDeafenToggle}
					className={`flex items-center justify-center w-12 h-12 rounded-lg border transition-all duration-200
						${isDeafened 
							? 'bg-destructive/10 border-destructive/50 text-destructive' 
							: 'bg-background border-border text-foreground hover:bg-muted hover:border-border-hover shadow-sm'}`}
				>
					{isDeafened ? <VolumeX size={20} /> : <Volume2 size={20} />}
				</button>
				<div className="w-px h-8 bg-border mx-2" />
				<button
					onClick={onDisconnect}
					className="flex items-center justify-center w-12 h-12 rounded-lg border border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive hover:text-white transition-all duration-200 shadow-sm"
				>
					<PhoneOff size={20} />
				</button>
			</div>
		</div>
	);
};
