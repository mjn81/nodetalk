import { useState, Profiler } from 'react';
import { logProfiler } from '@/utils/profiler';

import { Avatar } from '../Avatar';
import { Search, SlidersHorizontal, Hash, X, ChevronLeft, Users } from 'lucide-react';
import { type Channel } from '@/types/api';
import { getChannelDisplayName, useAppStore, useChannelStore } from '@/store/store';
import { GroupSettingsModal } from './GroupSettingsModal';
import { isDirectMessage } from '@/utils/channel';
import { useMediaQuery } from '@/hooks/useMediaQuery';

interface ChatTopbarProps {
	channel: Channel;
	currentUserId: string;
	searchQuery: string;
	onSearchChange: (query: string) => void;
}

export const ChatTopbar: React.FC<ChatTopbarProps> = ({
	channel,
	currentUserId,
	searchQuery,
	onSearchChange,
}) => {
	const [showSettings, setShowSettings] = useState(false);
	const [isSearching, setIsSearching] = useState(false);
	const isDM = isDirectMessage(channel);
	const otherMemberId =
		channel.members.find((m) => m !== currentUserId) || channel.id;

	// Only show settings icon for admins/owners of group channels
	const canManage = !isDM && channel.user_role >= 10;

	const isMobile = useMediaQuery('(max-width: 768px)');
	const { setRightSidebarOpen, isRightSidebarOpen } = useAppStore();
	const setActiveChannel = useChannelStore((state) => state.setActiveChannel);

	return (
		<Profiler id="ChatTopbar" onRender={logProfiler}>
			<div className="flex items-center justify-between px-4 h-12 border-b border-border shrink-0 shadow-sm relative z-10 bg-background">
				<div className="flex items-center gap-2 min-w-0">
					{isMobile && (
						<button
							onClick={() => setActiveChannel(null)}
							className="p-1 -ml-2 text-muted-foreground hover:text-foreground active:scale-95 transition-transform"
						>
							<ChevronLeft size={26} />
						</button>
					)}
					<div className="flex items-center gap-3 min-w-0">
						{isDM ? (
							<Avatar
								userId={otherMemberId}
								avatarId={channel.member_avatars?.[otherMemberId]}
								size={32}
							/>
						) : (
							<div className="w-8 h-8 flex items-center justify-center text-muted-foreground shrink-0">
								<Hash size={24} className="opacity-70" />
							</div>
						)}
						<div className="flex flex-col min-w-0">
							<div className="text-[15px] font-bold text-foreground leading-tight truncate">
								{getChannelDisplayName(channel, currentUserId)}
							</div>
							<div className="text-[13px] text-muted-foreground leading-tight">
								{isDM ? 'Direct Message' : `${channel.members.length} members`}
							</div>
						</div>
					</div>
				</div>
				<div className="flex items-center gap-2 sm:gap-4 text-muted-foreground">
					<div className={`flex items-center bg-secondary/50 rounded-lg px-2 transition-all duration-200 ${isSearching || searchQuery ? 'w-32 sm:w-48 ring-1 ring-primary/20' : 'w-9 bg-transparent'}`}>
						<button 
							onClick={() => setIsSearching(!isSearching)}
							className="hover:text-foreground transition p-1" 
							title="Search"
						>
							<Search size={20} className={`${(isSearching || searchQuery) ? 'text-primary opacity-100' : 'opacity-70'}`} />
						</button>
						{(isSearching || searchQuery) && (
							<>
								<input
									autoFocus
									type="text"
									placeholder="Search..."
									value={searchQuery}
									onChange={(e) => onSearchChange(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === 'Escape') {
											onSearchChange('');
											setIsSearching(false);
										}
									}}
									className="bg-transparent border-none outline-none text-sm w-full ml-1 text-foreground placeholder:text-muted-foreground/50"
									onBlur={() => {
										if (!searchQuery) setIsSearching(false);
									}}
								/>
								<button 
									onClick={() => {
										if (searchQuery) {
											onSearchChange('');
										} else {
											setIsSearching(false);
										}
									}}
									className="p-1 hover:text-foreground"
								>
									<X size={14} />
								</button>
							</>
						)}
					</div>

					{isMobile && !isDM && (
						<button
							onClick={() => setRightSidebarOpen(!isRightSidebarOpen)}
							className={`p-1 hover:text-foreground transition ${isRightSidebarOpen ? 'text-primary' : ''}`}
							title="Show Members"
						>
							<Users size={22} />
						</button>
					)}

					{canManage && (
						<button
							onClick={() => setShowSettings(true)}
							className="hover:text-foreground transition"
							title="Channel Settings"
						>
							<SlidersHorizontal
								size={22}
								className="opacity-80 hover:opacity-100"
							/>
						</button>
					)}
				</div>

				{showSettings && (
					<GroupSettingsModal
						channel={channel}
						onClose={() => setShowSettings(false)}
					/>
				)}
			</div>
		</Profiler>
	);
};

(ChatTopbar as any).whyDidYouRender = true;
