import { useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, LogOut } from 'lucide-react';
import { useChannelStore, useAuthStore } from '@/store/store';
import { apiLeaveChannel } from '@/api/client';
import { ConfirmModal } from '@/components/ConfirmModal';
import { isDirectMessage } from '@/utils/channel';

interface Member {
	id: string;
	username: string;
	domain: string;
	status: string;
	avatar_id?: string;
}

export default function RightSidebar() {
	const activeChannel = useChannelStore((state) => state.activeChannel);
	const refreshChannels = useChannelStore((state) => state.refreshChannels);
	const setActiveChannel = useChannelStore((state) => state.setActiveChannel);
	const user = useAuthStore((state) => state.user);
	const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
	const [loading, setLoading] = useState(false);

	if (!activeChannel) {
		return <div className="h-full bg-secondary"></div>;
	}

	const isDM = isDirectMessage(activeChannel);

	const handleLeave = async () => {
		if (!user) return;
		setLoading(true);
		try {
			await apiLeaveChannel(activeChannel.id, user.id);
			setActiveChannel(null);
			await refreshChannels();
		} catch (err) {
			console.error('Failed to leave channel:', err);
		} finally {
			setLoading(false);
		}
	};

	// ... Member mapping and Row component
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
		<div className="flex flex-col h-full bg-secondary border-l border-border/50">
			{/* Header */}
			<div className="h-12 border-b border-border flex items-center px-4 shrink-0 shadow-sm bg-background/50">
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

			{/* Leave Channel Footer */}
			{!isDM && (
				<div className="p-4 border-t border-border/50 bg-background/20">
					<button
						disabled={loading}
						onClick={() => setShowLeaveConfirm(true)}
						className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-destructive hover:bg-destructive/10 transition-all text-sm font-bold border border-transparent hover:border-destructive/20 active:scale-[0.98]"
					>
						<LogOut size={16} />
						Leave Channel
					</button>
				</div>
			)}

			<ConfirmModal
				isOpen={showLeaveConfirm}
				onClose={() => setShowLeaveConfirm(false)}
				onConfirm={handleLeave}
				title="Leave Channel"
				message={`Are you sure you want to leave "${activeChannel.name}"? You will need an invite link to join back later.`}
				confirmText="Leave Channel"
				variant="danger"
			/>
		</div>
	);
}
