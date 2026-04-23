
import { Avatar } from '../Avatar';
import { Search, SlidersHorizontal, Hash } from 'lucide-react';
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
		<div className="flex items-center justify-between px-4 h-12 border-b border-border shrink-0 shadow-sm relative z-10 bg-background">
			<div className="flex items-center gap-3">
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
			<div className="flex items-center gap-4 text-muted-foreground">
				<button className="hover:text-foreground transition" title="Search">
					<Search size={22} className="opacity-80 hover:opacity-100" />
				</button>
				<button className="hover:text-foreground transition" title="Settings">
					<SlidersHorizontal size={22} className="opacity-80 hover:opacity-100" />
				</button>
			</div>
		</div>
	);
};
