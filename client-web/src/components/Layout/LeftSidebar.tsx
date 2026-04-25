import { useEffect, useState, memo, useCallback, useMemo } from 'react';
import { Avatar } from '@/components/Avatar';
import NewChannelModal from '@/components/NewChannelModal';
import SettingsModal from '@/components/SettingsModal';
import { useExploreChannels } from '@/hooks/useChannels';
import { apiJoinChannel } from '@/api/client';
import { Settings, LogOut, Plus, Hash, Search, Volume2 } from 'lucide-react';
import { useVoiceStore } from '@/store/voiceStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
	useAppStore,
	useAuthStore,
	useChannelStore,
	getChannelDisplayName,
} from '@/store/store';
import type { AuthUser, Channel } from '@/types/api';
import { isDirectMessage } from '@/utils/channel';

const RenderChannel = memo(
	({
		ch,
		isGroup,
		user,
		isActive,
		onSelect,
	}: {
		ch: Channel;
		isGroup: boolean;
		user: AuthUser | null;
		isActive: boolean;
		onSelect: (ch: Channel) => void;
	}) => {
		const display = getChannelDisplayName(ch, user?.id ?? '');
		const hasVoice = useVoiceStore(state => (state.participants[ch.id]?.length ?? 0) > 0);

		return (
			<div
				onClick={() => onSelect(ch)}
				className={`w-full flex items-center gap-3 px-2 py-1.5 rounded-md cursor-pointer transition ${
					isActive
						? 'bg-accent text-foreground'
						: 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
				}`}
			>
				{isGroup ? (
					<div className="relative shrink-0">
						<Hash className="w-5 h-5 shrink-0 opacity-70" />
						{hasVoice && (
							<div className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground rounded-full p-0.5 shadow-sm border border-secondary animate-in zoom-in duration-300">
								<Volume2 size={10} fill="currentColor" />
							</div>
						)}
					</div>
				) : (
					<div className="relative shrink-0">
						<Avatar
							userId={ch.members.find((m) => m !== user?.id) || ch.id}
							avatarId={
								ch.member_avatars?.[
									ch.members.find((m) => m !== user?.id) || ''
								]
							}
							size={32}
						/>
						<div
							className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-[2px] border-secondary z-10 ${
								ch.member_statuses?.[
									ch.members.find((m) => m !== user?.id) || ''
								] === 'online'
									? 'bg-green-500'
									: ch.member_statuses?.[
												ch.members.find((m) => m !== user?.id) || ''
										  ] === 'away'
										? 'bg-yellow-500'
										: ch.member_statuses?.[
													ch.members.find((m) => m !== user?.id) || ''
											  ] === 'dnd'
											? 'bg-red-500'
											: 'bg-gray-500'
							}`}
						/>
						{hasVoice && (
							<div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5 shadow-sm border border-secondary z-10 animate-in zoom-in duration-300">
								<Volume2 size={10} fill="currentColor" />
							</div>
						)}
					</div>
				)}
				<div className="min-w-0 flex-1 flex items-center gap-2">
					<span className="truncate text-[15px] font-medium">{display}</span>
					{!isActive && (ch.unread_count ?? 0) > 0 && (
						<div className="flex items-center justify-center min-w-[16px] h-4 bg-[#f23f42] rounded-full text-[11px] font-bold text-white px-1 opacity-90 shadow-sm shrink-0 ml-auto">
							{ch.unread_count}
						</div>
					)}
				</div>
			</div>
		);
	},
);

RenderChannel.displayName = 'RenderChannel';

export default function LeftSidebar() {
	const user = useAuthStore((state) => state.user);
	const logout = useAuthStore((state) => state.logout);
	const channels = useChannelStore((state) => state.channels);
	const isLoading = useChannelStore((state) => state.isChannelsLoading);
	const activeChannelId = useChannelStore((state) => state.activeChannel?.id);
	const setActiveChannel = useChannelStore((state) => state.setActiveChannel);
	const appVersion = useAppStore((state) => state.appVersion);
	const fetchVersion = useAppStore((state) => state.fetchVersion);
	const wsState = useAppStore((state) => state.wsState);
	const handleSelectChannel = useCallback(
		(ch: Channel) => {
			setActiveChannel(ch);
		},
		[setActiveChannel],
	);
	const [search, setSearch] = useState('');
	const [debouncedSearch, setDebouncedSearch] = useState('');
	const [isJoining, setIsJoining] = useState<string | null>(null);

	const [showNewChannel, setShowNew] = useState(false);
	const [showSettings, setShowSettings] = useState(false);
	const [modalTab, setModalTab] = useState<'dm' | 'channel'>('dm');

	useEffect(() => {
		fetchVersion();
	}, [fetchVersion]);

	useEffect(() => {
		const handler = setTimeout(() => {
			setDebouncedSearch(search.trim());
		}, 300);
		return () => clearTimeout(handler);
	}, [search]);

	const { data: exploreChannels = [], isFetching: isExploring } =
		useExploreChannels(debouncedSearch);

	const handleJoinChannel = async (link: string, id: string) => {
		if (isJoining) return;
		try {
			setIsJoining(id);
			await apiJoinChannel(link);
			await useChannelStore.getState().refreshChannels();
			const active = useChannelStore
				.getState()
				.channels.find((c) => c.id === id);
			if (active) useChannelStore.getState().setActiveChannel(active);
			setSearch('');
		} catch (error) {
			console.error(error);
		} finally {
			setIsJoining(null);
		}
	};

	const filtered = useMemo(() => {
		return channels.filter((ch) => {
			const display = getChannelDisplayName(ch, user?.id ?? '');
			return display.toLowerCase().includes(search.toLowerCase());
		});
	}, [channels, user?.id, search]);

	const { dmChannels, groupChannels } = useMemo(() => {
		const dms = filtered.filter((ch) => isDirectMessage(ch));
		const groups = filtered.filter((ch) => !dms.some((dm) => dm.id === ch.id));
		return { dmChannels: dms, groupChannels: groups };
	}, [filtered]);

	return (
		<div className="flex flex-col h-full bg-secondary w-full overflow-hidden">
			{/* Server Header */}
			<div className="h-12 border-b border-border flex items-center px-4 shrink-0 shadow-sm transition-colors hover:bg-accent/30 cursor-pointer">
				<div className="flex-1 flex flex-row justify-between items-center min-w-0">
					<h2 className="font-bold text-[15px] text-foreground truncate leading-tight">
						NodeTalk Client
					</h2>
					<span className="text-[11px] text-muted-foreground font-medium inline-flex items-center gap-1.5 shrink-0">
						{appVersion}
						<span
							className={`w-2 h-2 rounded-full ${
								wsState === 'connected'
									? 'bg-green-500'
									: wsState === 'connecting'
										? 'bg-yellow-500'
										: 'bg-red-500'
							}`}
							title={wsState}
						/>
					</span>
				</div>
			</div>

			{/* Search area */}
			<div className="px-3 pt-3 pb-2 shrink-0 flex items-center gap-2">
				<div className="relative flex-1">
					<Input
						id="search-explore-input"
						name="search-explore"
						type="text"
						className="bg-popover border-none text-[13px] h-8 pl-8 pr-2 text-foreground focus-visible:ring-0 rounded-md placeholder:text-muted-foreground w-full"
						placeholder="Search or explore..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						autoComplete="off"
						autoCorrect="off"
						autoCapitalize="none"
					/>
					<Search className="absolute left-2.5 top-2 w-4 h-4 text-muted-foreground" />
				</div>
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent shrink-0"
					onClick={() => {
						setModalTab('channel');
						setShowNew(true);
					}}
					title="Create"
				>
					<Plus className="w-4 h-4" />
				</Button>
			</div>

			{/* Channel Lists */}
			<ScrollArea className="flex-1 w-full min-h-0">
				{isLoading ? (
					<div className="flex justify-center py-4">
						<span className="spinner" />
					</div>
				) : (
					<div className="pb-4">
						<div className="mt-4">
							<div className="flex items-center justify-between px-4 mb-[2px]">
								<span className="text-xs font-semibold text-muted-foreground hover:text-foreground cursor-default tracking-wider">
									CHANNELS
								</span>
							</div>
							<div className="flex flex-col gap-0.5 px-2">
								{groupChannels.map((ch) => (
									<RenderChannel
										key={ch.id}
										ch={ch}
										isGroup={true}
										user={user}
										isActive={activeChannelId === ch.id}
										onSelect={handleSelectChannel}
									/>
								))}
							</div>
						</div>

						<div className="mt-6">
							<div className="flex items-center justify-between px-4 mb-[2px]">
								<span className="text-xs font-semibold text-muted-foreground hover:text-foreground cursor-default tracking-wider">
									DIRECT MESSAGES
								</span>
							</div>
							<div className="flex flex-col gap-0.5 px-2">
								{dmChannels.map((ch) => (
									<RenderChannel
										key={ch.id}
										ch={ch}
										isGroup={false}
										user={user}
										isActive={activeChannelId === ch.id}
										onSelect={handleSelectChannel}
									/>
								))}
							</div>
						</div>

						{filtered.length === 0 && !isLoading && !search && (
							<div className="text-center mt-6 text-muted-foreground text-xs px-4">
								No conversations. Click + to start!
							</div>
						)}

						{search && (
							<div className="mt-6">
								<div className="flex items-center justify-between px-4 mb-[2px]">
									<span className="text-xs font-semibold text-[#949ba4] uppercase tracking-wider">
										Public Channels
									</span>
								</div>
								{isExploring ? (
									<div className="flex justify-center py-4">
										<span className="spinner" />
									</div>
								) : exploreChannels.length > 0 ? (
									<div className="flex flex-col gap-0.5 mt-2">
										{exploreChannels.map((ch) => {
											const isJoined = channels.some((c) => c.id === ch.id);
											if (isJoined) return null;

											return (
												<div
													key={ch.id}
													onClick={() =>
														handleJoinChannel(ch.invite_link, ch.id)
													}
													className="flex items-center justify-between px-2 py-1.5 mx-2 rounded-md cursor-pointer transition min-w-0 overflow-hidden text-muted-foreground hover:bg-accent/50 hover:text-foreground"
												>
													<div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
														<Hash className="w-5 h-5 shrink-0 opacity-70" />
														<span className="truncate text-[15px] font-medium leading-none min-w-0 flex-1">
															{ch.name}
														</span>
													</div>
													{isJoining === ch.id ? (
														<span className="spinner small" />
													) : (
														<span className="text-xs font-semibold text-[#5865F2]">
															Join
														</span>
													)}
												</div>
											);
										})}
									</div>
								) : (
									<div className="text-center mt-2 text-muted-foreground text-xs px-4">
										No public channels found.
									</div>
								)}
							</div>
						)}
					</div>
				)}
			</ScrollArea>

			{/* User Controls Footer */}
			<div className="h-[52px] bg-secondary/80 backdrop-blur-sm shrink-0 flex items-center px-2 gap-2 border-t border-border/50">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<div className="flex items-center gap-2 flex-1 min-w-0 hover:bg-accent p-1 rounded-md cursor-pointer transition">
							<div className="relative">
								<Avatar
									userId={user?.id || ''}
									avatarId={user?.avatar_id}
									size={32}
									className="shrink-0"
								/>
								<div
									className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-[2px] border-secondary z-10 ${
										user?.status === 'online'
											? 'bg-green-500'
											: user?.status === 'away'
												? 'bg-yellow-500'
												: user?.status === 'dnd'
													? 'bg-red-500'
													: 'bg-gray-500'
									}`}
								/>
							</div>
							<div className="flex flex-col flex-1 min-w-0 leading-tight">
								<span className="text-[13px] font-bold text-foreground truncate">
									{user?.username}
								</span>
								<span className="text-[11px] text-muted-foreground truncate">
									{user?.status
										? user.status.charAt(0).toUpperCase() + user.status.slice(1)
										: 'Offline'}
								</span>
							</div>
						</div>
					</DropdownMenuTrigger>

					<DropdownMenuContent
						align="start"
						className="w-48 bg-popover border-border text-foreground"
					>
						<DropdownMenuItem
							onClick={logout}
							className="text-red-400 hover:text-red-300 focus:bg-[#f23f42] focus:text-white cursor-pointer"
						>
							<LogOut className="mr-2 h-4 w-4" />
							<span>Log out</span>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>

				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent"
					onClick={() => setShowSettings(true)}
				>
					<Settings className="w-5 h-5" />
				</Button>
			</div>

			{showNewChannel && (
				<NewChannelModal
					initialTab={modalTab}
					onClose={() => setShowNew(false)}
				/>
			)}
			{showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
		</div>
	);
}
