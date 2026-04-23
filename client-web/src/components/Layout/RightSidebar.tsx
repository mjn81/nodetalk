import { Avatar } from '@/components/Avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users } from 'lucide-react';
import { useChannelStore } from '@/store/store';

interface Member {
	id: string;
	username: string;
	domain: string;
	status: string;
	avatar_id?: string;
}

export default function RightSidebar() {
	const activeChannel = useChannelStore((state) => state.activeChannel);

	if (!activeChannel) {
		return <div className="h-full bg-secondary"></div>;
	}

	// Discord typically separates Online from Offline members.
	const members: Member[] = activeChannel.members.map(id => ({
		id,
		username: activeChannel.member_names?.[id] || id,
		domain: activeChannel.member_domains?.[id] || '',
		status: activeChannel.member_statuses?.[id] || 'offline',
		avatar_id: activeChannel.member_avatars?.[id],
	}));

	const onlineMembers = members.filter((m) => m.status !== 'offline');
	const offlineMembers = members.filter((m) => m.status === 'offline');

	const MemberRow = ({ member }: { member: Member }) => (
		<div
			key={member.id}
			className="flex items-center gap-3 px-2 py-1 mx-2 rounded-md cursor-pointer transition hover:bg-accent/50 group"
		>
			<div className="relative">
				<Avatar 
					userId={member.id} 
					avatarId={member.avatar_id}
					size={32} 
					className="shrink-0" 
				/>
				<div
					className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-[3px] border-secondary group-hover:border-accent/50 transition-colors ${
						member.status === 'online' ? 'bg-green-500' :
						member.status === 'away' ? 'bg-yellow-500' :
						member.status === 'dnd' ? 'bg-red-500' :
						'bg-gray-500'
					}`}
				/>
			</div>
			<div className="flex flex-col flex-1 min-w-0">
				<span
					className={`text-[15px] font-medium leading-tight truncate ${member.status !== 'offline' ? 'text-foreground' : 'text-muted-foreground/60'}`}
				>
					{member.username}
				</span>
			</div>
		</div>
	);

	return (
		<div className="flex flex-col h-full bg-secondary">
			{/* Header */}
			<div className="h-12 border-b border-border flex items-center px-4 shrink-0 shadow-sm">
				<Users className="w-5 h-5 text-muted-foreground mr-2" />
				<h2 className="font-bold text-[15px] text-foreground">Members</h2>
			</div>

			<ScrollArea className="flex-1 mt-4">
				<div className="pb-4 flex flex-col gap-4">
					{onlineMembers.length > 0 && (
						<div>
							<h3 className="text-xs font-semibold text-muted-foreground px-4 mb-1 tracking-wider uppercase">
								Online — {onlineMembers.length}
							</h3>
							<div className="flex flex-col gap-0.5">
								{onlineMembers.map((m) => (
									<MemberRow key={m.id} member={m} />
								))}
							</div>
						</div>
					)}

					{offlineMembers.length > 0 && (
						<div>
							<h3 className="text-xs font-semibold text-muted-foreground px-4 mb-1 tracking-wider uppercase">
								Offline — {offlineMembers.length}
							</h3>
							<div className="flex flex-col gap-0.5">
								{offlineMembers.map((m) => (
									<MemberRow key={m.id} member={m} />
								))}
							</div>
						</div>
					)}
				</div>
			</ScrollArea>
		</div>
	);
}
