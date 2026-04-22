import React from 'react';
import { Avatar } from '../Avatar';
import { Search, SlidersHorizontal } from 'lucide-react';
import { type Channel } from '@/types/api';
import { getChannelDisplayName } from '@/store/store';

interface ChatTopbarProps {
	channel: Channel;
	currentUserId: string;
}

export const ChatTopbar: React.FC<ChatTopbarProps> = ({ channel, currentUserId }) => {
	const isDM = channel.members.length === 2 && (!channel.name || channel.name.trim() === '');
	const otherMemberId = channel.members.find(m => m !== currentUserId) || channel.id;

	return (
		<div className="flex items-center justify-between px-4 h-12 border-b border-[#1e1f22] shrink-0 shadow-sm relative z-10 bg-background">
			<div className="flex items-center gap-3">
				<Avatar 
					userId={isDM ? otherMemberId : channel.id} 
					avatarId={isDM ? channel.member_avatars?.[otherMemberId] : undefined}
					size={36} 
				/>
				<div className="flex flex-col min-w-0">
					<div className="text-[15px] font-bold text-white leading-tight truncate">
						{getChannelDisplayName(channel, currentUserId)}
					</div>
					<div className="text-[13px] text-[#949ba4] leading-tight">
						{isDM ? 'Direct Message' : `${channel.members.length} members`}
					</div>
				</div>
			</div>
			<div className="flex items-center gap-4 text-[#b5bac1]">
				<button className="hover:text-[#dbdee1] transition" title="Search">
					<Search size={22} className="opacity-80 hover:opacity-100" />
				</button>
				<button className="hover:text-[#dbdee1] transition" title="Settings">
					<SlidersHorizontal size={22} className="opacity-80 hover:opacity-100" />
				</button>
			</div>
		</div>
	);
};
