import { useState } from 'react';
import { useStore, getChannelDisplayName } from '@/store/useStore';
import { Avatar as MinidenticonAvatar } from '@/components/Avatar';
import NewChannelModal from '@/components/NewChannelModal';
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

export default function LeftSidebar() {
	const user = useStore((state) => state.user);
	const logout = useStore((state) => state.logout);
	const channels = useStore((state) => state.channels);
	const activeChannel = useStore((state) => state.activeChannel);
	const setActiveChannel = useStore((state) => state.setActiveChannel);
	const isLoading = useStore((state) => state.isChannelsLoading);
	const [search, setSearch] = useState('');
	const [showNewChannel, setShowNew] = useState(false);

	const filtered = channels.filter((ch) => {
		const display = getChannelDisplayName(ch, user?.user_id ?? '');
		return display.toLowerCase().includes(search.toLowerCase());
	});

	const dmChannels = filtered.filter((ch) => ch.members.length === 2);
	const groupChannels = filtered.filter((ch) => ch.members.length !== 2);

	const renderChannel = (ch: (typeof channels)[number], isGroup: boolean) => {
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
				<span className="truncate text-[15px] font-medium leading-none">
					{display}
				</span>
			</div>
		);
	};

	return (
		<div className="flex flex-col h-full bg-[#2b2d31]">
			{/* Server Header */}
			<div className="h-12 border-b border-[#1e1f22] flex items-center px-4 shrink-0 shadow-sm transition-colors hover:bg-[#35373c] cursor-pointer">
				<h2 className="font-bold text-[15px] text-white flex-1 truncate">
					NodeTalk Server
				</h2>
			</div>

			{/* Search area */}
			<div className="px-2 pt-3 pb-2 shrink-0">
				<Button
					variant="secondary"
					className="w-full justify-start text-[#949ba4] bg-[#1e1f22] hover:bg-[#1e1f22] h-7 text-xs font-medium px-2"
					onClick={() => document.getElementById('channel-search')?.focus()}
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
										onClick={() => setShowNew(true)}
										className="text-[#949ba4] hover:text-[#dbdee1] focus:outline-none"
									>
										<Plus className="w-4 h-4" />
									</button>
								</div>
								<div className="flex flex-col gap-0.5">
									{groupChannels.map((ch) => renderChannel(ch, true))}
								</div>
							</div>
						)}

						<div className="mt-6">
							<div className="flex items-center justify-between px-4 mb-[2px]">
								<span className="text-xs font-semibold text-[#949ba4] hover:text-[#dbdee1] cursor-pointer tracking-wider">
									DIRECT MESSAGES
								</span>
								<button
									onClick={() => setShowNew(true)}
									className="text-[#949ba4] hover:text-[#dbdee1] focus:outline-none"
								>
									<Plus className="w-4 h-4" />
								</button>
							</div>
							<div className="flex flex-col gap-0.5">
								{dmChannels.map((ch) => renderChannel(ch, false))}
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
				<div className="flex items-center gap-2 flex-1 min-w-0 hover:bg-[#3f4147] p-1 rounded-md cursor-pointer transition">
					<Avatar className="w-8 h-8 shrink-0 relative">
						<AvatarFallback className="bg-transparent">
							<MinidenticonAvatar userId={user?.user_id ?? ''} size={32} />
						</AvatarFallback>
						<div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#232428]" />
					</Avatar>
					<div className="flex flex-col flex-1 min-w-0 leading-tight">
						<span className="text-[13px] font-bold text-white truncate">
							{user?.username}
						</span>
						<span className="text-[11px] text-[#949ba4] truncate">Online</span>
					</div>
				</div>

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="h-8 w-8 text-[#b5bac1] hover:text-[#dbdee1] hover:bg-[#3f4147]"
						>
							<Settings className="w-5 h-5" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align="end"
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
			</div>

			{showNewChannel && <NewChannelModal onClose={() => setShowNew(false)} />}
		</div>
	);
}
