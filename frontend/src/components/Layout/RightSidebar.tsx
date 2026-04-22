import { useChannelMembers } from '@/hooks/useChannels';
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
	const { data: members = [], isLoading } = useChannelMembers(
		activeChannel?.id,
	);

	if (!activeChannel) {
		return <div className="h-full bg-[#2b2d31]"></div>;
	}

	// Discord typically separates Online from Offline members.
	// Discord typically separates Online from Offline members.
	const onlineMembers = members.filter((m) => m.status !== 'offline');
	const offlineMembers = members.filter((m) => m.status === 'offline');

	const MemberRow = ({ member }: { member: Member }) => (
		<div
			key={member.id}
			className="flex items-center gap-3 px-2 py-1 mx-2 rounded-md cursor-pointer transition hover:bg-[#35373c] group"
		>
			<div className="relative">
				<Avatar 
					userId={member.id} 
					avatarId={member.avatar_id}
					size={32} 
					className="shrink-0" 
				/>
				<div
					className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-[3px] border-[#2b2d31] group-hover:border-[#35373c] transition-colors ${
						member.status === 'online' ? 'bg-green-500' :
						member.status === 'away' ? 'bg-yellow-500' :
						member.status === 'dnd' ? 'bg-red-500' :
						'bg-gray-500'
					}`}
				/>
			</div>
			<div className="flex flex-col flex-1 min-w-0">
				<span
					className={`text-[15px] font-medium leading-tight truncate ${member.status !== 'offline' ? 'text-[#f2f3f5]' : 'text-[#80848E]'}`}
				>
					{member.username}
				</span>
			</div>
		</div>
	);

	return (
		<div className="flex flex-col h-full bg-[#2b2d31]">
			{/* Header */}
			<div className="h-12 border-b border-[#1e1f22] flex items-center px-4 shrink-0 shadow-sm">
				<Users className="w-5 h-5 text-[#949ba4] mr-2" />
				<h2 className="font-bold text-[15px] text-white">Members</h2>
			</div>

			<ScrollArea className="flex-1 mt-4">
				{isLoading ? (
					<div className="flex justify-center py-4">
						<span className="spinner" />
					</div>
				) : (
					<div className="pb-4 flex flex-col gap-4">
						{onlineMembers.length > 0 && (
							<div>
								<h3 className="text-xs font-semibold text-[#949ba4] px-4 mb-1 tracking-wider uppercase">
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
								<h3 className="text-xs font-semibold text-[#949ba4] px-4 mb-1 tracking-wider uppercase">
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
				)}
			</ScrollArea>
		</div>
	);
}
