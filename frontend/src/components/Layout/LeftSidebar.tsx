import { useEffect, useState } from 'react';
import { Avatar as MinidenticonAvatar } from '@/components/Avatar';
import NewChannelModal from '@/components/NewChannelModal';
import SettingsModal from '@/components/SettingsModal';
import { Settings, LogOut, Plus, Hash } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import type { AuthUser, Channel } from '@/api/client';


const RenderChannel = ({ch, isGroup, user}:{ch: Channel[][number], isGroup: boolean, user: AuthUser | null}) => {
	const activeChannel = useChannelStore((state) => state.activeChannel);
	const setActiveChannel = useChannelStore((state) => state.setActiveChannel);
	const display = getChannelDisplayName(ch, user?.user_id ?? '');
	const isActive = activeChannel?.id === ch.id;

	return (
		<div
			key={ch.id}
			onClick={() => setActiveChannel(ch)}
			className={`flex items-center gap-3 px-2 py-1.5 mx-2 rounded-md cursor-pointer transition flex-1 min-w-0 ${
				isActive
					? 'bg-[#3f4147] text-white'
					: 'text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1]'
			}`}
		>
			{isGroup ? (
				<Hash className="w-5 h-5 shrink-0 opacity-70" />
			) : (
				<Avatar className="w-8 h-8 shrink-0">
					<AvatarImage
						src={`data:image/svg+xml;utf8,${encodeURIComponent('<svg></svg>')}`}
					/>
					<AvatarFallback className="bg-transparent">
						<MinidenticonAvatar userId={ch.id} size={32} />
					</AvatarFallback>
				</Avatar>
			)}
			<div className="flex-1 min-w-0 flex items-center justify-between">
				<span className="truncate text-[15px] font-medium leading-none">
					{display}
				</span>
				{!isActive && (ch.unread_count ?? 0) > 0 && (
					<div className="flex items-center justify-center min-w-[16px] h-4 bg-[#f23f42] rounded-full text-[11px] font-bold text-white px-1 ml-1 opacity-90 shadow-sm shrink-0">
						{ch.unread_count}
					</div>
				)}
			</div>
		</div>
	);
};

export default function LeftSidebar() {
	const user = useAuthStore((state) => state.user);
	const logout = useAuthStore((state) => state.logout);
	const channels = useChannelStore((state) => state.channels);
	const isLoading = useChannelStore((state) => state.isChannelsLoading);
	const appVersion = useAppStore((state) => state.appVersion);
	const fetchVersion = useAppStore((state) => state.fetchVersion);
	const wsState = useAppStore((state) => state.wsState);
	const [search, setSearch] = useState('');
	const [showNewChannel, setShowNew] = useState(false);
	const [showSettings, setShowSettings] = useState(false);
	const [modalTab, setModalTab] = useState<'dm' | 'channel'>('dm');
	useEffect(() => {
		fetchVersion()
	}, [fetchVersion])

	const filtered = channels.filter((ch) => {
		const display = getChannelDisplayName(ch, user?.user_id ?? '');
		return display.toLowerCase().includes(search.toLowerCase());
	});

	const dmChannels = filtered.filter((ch) => ch.members.length === 2);
	const groupChannels = filtered.filter((ch) => ch.members.length !== 2);

	return (
		<div className="flex flex-col h-full bg-[#2b2d31]">
			{/* Server Header */}
			<div className="h-12 border-b border-[#1e1f22] flex items-center px-4 shrink-0 shadow-sm transition-colors hover:bg-[#35373c] cursor-pointer">
				<div className="flex-1 flex flex-row justify-between min-w-0">
					<h2 className="font-bold text-[15px] text-white truncate leading-tight">
						NodeTalk Client
					</h2>
					<span className="text-[11px] text-[#949ba4] font-medium inline-flex items-center gap-1.5">
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
			<div className="px-2 pt-3 pb-2 shrink-0">
				<Button
					variant="secondary"
					className="w-full justify-start text-[#949ba4] bg-[#1e1f22] hover:bg-[#1e1f22] h-8 py-2 text-xs font-medium px-2 shadow-sm"
					onClick={() => {
						setModalTab('dm');
						setShowNew(true);
					}}
				>
					Find or start a conversation
				</Button>
				{/* Hidden search input that could be mapped to click above instead */}
				<div className="hidden">
					<Input
						id="channel-search"
						value={search}
						onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
							setSearch(e.target.value)
						}
					/>
				</div>
			</div>

			{/* Channel Lists */}
			<ScrollArea className="flex-1">
				{isLoading ? (
					<div className="flex justify-center py-4">
						<span className="spinner" />
					</div>
				) : (
					<div className="pb-4">
						{groupChannels.length > 0 && (
							<div className="mt-4">
								<div className="flex items-center justify-between px-4 mb-[2px]">
									<span className="text-xs font-semibold text-[#949ba4] hover:text-[#dbdee1] cursor-pointer tracking-wider">
										CHANNELS
									</span>
									<button
										onClick={() => {
											setModalTab('channel');
											setShowNew(true);
										}}
										className="text-[#949ba4] hover:text-[#dbdee1] focus:outline-none"
									>
										<Plus className="w-4 h-4" />
									</button>
								</div>
								<div className="flex flex-col gap-0.5">
									{groupChannels.map((ch) => (
										<RenderChannel ch={ch} isGroup={true} user={user} />
									))}
								</div>
							</div>
						)}

						<div className="mt-6">
							<div className="flex items-center justify-between px-4 mb-[2px]">
								<span className="text-xs font-semibold text-[#949ba4] hover:text-[#dbdee1] cursor-pointer tracking-wider">
									DIRECT MESSAGES
								</span>
								<button
									onClick={() => {
										setModalTab('dm');
										setShowNew(true);
									}}
									className="text-[#949ba4] hover:text-[#dbdee1] focus:outline-none"
								>
									<Plus className="w-4 h-4" />
								</button>
							</div>
							<div className="flex flex-col gap-0.5">
								{dmChannels.map((ch) => (
									<RenderChannel ch={ch} isGroup={false} user={user} />
								))}
							</div>
						</div>

						{filtered.length === 0 && !isLoading && (
							<div className="text-center mt-6 text-[#949ba4] text-xs px-4">
								{search
									? 'No matches found.'
									: 'No conversations. Click + to start!'}
							</div>
						)}
					</div>
				)}
			</ScrollArea>

			{/* User Controls Footer */}
			<div className="h-[52px] bg-[#232428] shrink-0 flex items-center px-2 gap-2">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<div className="flex items-center gap-2 flex-1 min-w-0 hover:bg-[#3f4147] p-1 rounded-md cursor-pointer transition">
							<Avatar className="w-8 h-8 shrink-0 relative overflow-visible">
								<AvatarFallback className="bg-transparent overflow-hidden rounded-full">
									<MinidenticonAvatar userId={user?.user_id ?? ''} size={32} />
								</AvatarFallback>
								<div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-[2.5px] border-[#232428] z-10 box-content" />
							</Avatar>
							<div className="flex flex-col flex-1 min-w-0 leading-tight">
								<span className="text-[13px] font-bold text-white truncate">
									{user?.username}
								</span>
								<span className="text-[11px] text-[#949ba4] truncate">
									Online
								</span>
							</div>
						</div>
					</DropdownMenuTrigger>

					<DropdownMenuContent
						align="start"
						className="w-48 bg-[#111214] border-none text-[#dbdee1]"
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
					className="h-8 w-8 text-[#b5bac1] hover:text-[#dbdee1] hover:bg-[#3f4147]"
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
