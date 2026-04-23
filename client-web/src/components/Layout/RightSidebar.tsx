import { useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, LogOut, UserMinus, Shield } from 'lucide-react';
import { useChannelStore, useAuthStore } from '@/store/store';
import { apiLeaveChannel, apiUpdateMemberRole } from '@/api/client';
import { ConfirmModal } from '@/components/ConfirmModal';
import { isDirectMessage } from '@/utils/channel';
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
	ContextMenuSeparator,
} from '@/components/ui/context-menu';

interface Member {
	id: string;
	username: string;
	domain: string;
	status: string;
	avatar_id?: string;
	role: number;
}

export default function RightSidebar() {
	const activeChannel = useChannelStore((state) => state.activeChannel);
	const refreshChannels = useChannelStore((state) => state.refreshChannels);
	const setActiveChannel = useChannelStore((state) => state.setActiveChannel);
	const user = useAuthStore((state) => state.user);
	const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
	const [showKickConfirm, setShowKickConfirm] = useState<Member | null>(null);
	const [loading, setLoading] = useState(false);

	if (!activeChannel) {
		return <div className="h-full bg-secondary"></div>;
	}

	const isDM = isDirectMessage(activeChannel);
	const myRole = activeChannel.user_role ?? 0;

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

	const handleKick = async () => {
		if (!showKickConfirm) return;
		setLoading(true);
		try {
			await apiLeaveChannel(activeChannel.id, showKickConfirm.id);
			await refreshChannels();
			setShowKickConfirm(null);
		} catch (err) {
			console.error('Failed to kick member:', err);
		} finally {
			setLoading(false);
		}
	};

	const handleUpdateRole = async (targetUserId: string, newRole: number) => {
		setLoading(true);
		try {
			await apiUpdateMemberRole(activeChannel.id, targetUserId, newRole);
			await refreshChannels();
		} catch (err) {
			console.error('Failed to update role:', err);
		} finally {
			setLoading(false);
		}
	};

	const members: Member[] = activeChannel.members.map(id => ({
		id,
		username: activeChannel.member_names?.[id] || id,
		domain: activeChannel.member_domains?.[id] || '',
		status: activeChannel.member_statuses?.[id] || 'offline',
		avatar_id: activeChannel.member_avatars?.[id],
		role: activeChannel.member_roles?.[id] ?? 0,
	}));

	// Grouping logic (Discord style)
	const owners = members.filter(m => m.role >= 20 && m.status !== 'offline');
	const admins = members.filter(m => m.role === 10 && m.status !== 'offline');
	const onlineMembers = members.filter(m => m.role === 0 && m.status !== 'offline');
	const offlineMembers = members.filter(m => m.status === 'offline');

	return (
		<div className="flex flex-col h-full bg-secondary border-l border-border/50">
			{/* Header */}
			<div className="h-12 border-b border-border flex items-center px-4 shrink-0 shadow-sm bg-background/50">
				<Users className="w-4 h-4 text-muted-foreground mr-2.5" />
				<h2 className="font-bold text-[14px] text-foreground/90">Members</h2>
			</div>

			<ScrollArea className="flex-1">
				<div className="pt-5 pb-4 flex flex-col">
					<Section 
						title="Owner" 
						count={owners.length} 
						list={owners} 
						user={user}
						isDM={isDM}
						myRole={myRole}
						onUpdateRole={handleUpdateRole}
						onKick={setShowKickConfirm}
					/>
					<Section 
						title="Admins" 
						count={admins.length} 
						list={admins} 
						user={user}
						isDM={isDM}
						myRole={myRole}
						onUpdateRole={handleUpdateRole}
						onKick={setShowKickConfirm}
					/>
					<Section 
						title="Online" 
						count={onlineMembers.length} 
						list={onlineMembers} 
						user={user}
						isDM={isDM}
						myRole={myRole}
						onUpdateRole={handleUpdateRole}
						onKick={setShowKickConfirm}
					/>
					<Section 
						title="Offline" 
						count={offlineMembers.length} 
						list={offlineMembers} 
						user={user}
						isDM={isDM}
						myRole={myRole}
						onUpdateRole={handleUpdateRole}
						onKick={setShowKickConfirm}
					/>
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

			<ConfirmModal
				isOpen={!!showKickConfirm}
				onClose={() => setShowKickConfirm(null)}
				onConfirm={handleKick}
				title="Kick Member"
				message={`Are you sure you want to kick ${showKickConfirm?.username} from the channel? They will need a new invite to rejoin.`}
				confirmText="Kick Member"
				variant="danger"
			/>
		</div>
	);
}

interface SectionProps {
	title: string;
	count: number;
	list: Member[];
	user: any;
	isDM: boolean;
	myRole: number;
	onUpdateRole: (id: string, role: number) => void;
	onKick: (member: Member) => void;
}

const Section = ({ title, count, list, ...props }: SectionProps) => {
	if (list.length === 0) return null;
	return (
		<div className="mb-5">
			<h3 className="text-[11px] font-bold text-muted-foreground/60 px-4 mb-1 tracking-wider uppercase select-none">
				{title} — {count}
			</h3>
			<div className="flex flex-col gap-0.5">
				{list.map((m) => (
					<MemberRow key={m.id} member={m} {...props} />
				))}
			</div>
		</div>
	);
};

interface MemberRowProps {
	member: Member;
	user: any;
	isDM: boolean;
	myRole: number;
	onUpdateRole: (id: string, role: number) => void;
	onKick: (member: Member) => void;
}

const MemberRow = ({ member, user, isDM, myRole, onUpdateRole, onKick }: MemberRowProps) => {
	const isMe = member.id === user?.id;
	const canKick = !isDM && myRole >= 10 && myRole > member.role && !isMe;
	const canPromote = !isDM && myRole >= 20 && member.role === 0 && !isMe;
	const canDemote = !isDM && myRole >= 20 && member.role === 10 && !isMe;

	const roleColor = member.role >= 20 ? 'text-amber-400' : member.role === 10 ? 'text-blue-400' : 'text-foreground';

	return (
		<ContextMenu>
			<ContextMenuTrigger>
				<div
					className="flex items-center gap-3 px-2 py-1.5 mx-2 rounded-md cursor-pointer transition-all hover:bg-white/5 active:bg-white/10 group relative"
				>
					<div className="relative shrink-0">
						<Avatar 
							userId={member.id} 
							avatarId={member.avatar_id}
							size={32} 
							className="shrink-0" 
						/>
						<div
							className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-[3px] border-secondary group-hover:border-accent/50 transition-colors ${
								member.status === 'online' ? 'bg-green-500' :
								member.status === 'away' ? 'bg-yellow-500' :
								member.status === 'dnd' ? 'bg-red-500' :
								'bg-gray-500'
							}`}
						/>
					</div>
					<div className="flex flex-col flex-1 min-w-0">
						<div className="flex items-center gap-1.5 min-w-0">
							<span
								className={`text-[14px] font-medium leading-tight truncate ${member.status !== 'offline' ? roleColor : 'text-muted-foreground/50'}`}
							>
								{member.username}
							</span>
						</div>
					</div>
				</div>
			</ContextMenuTrigger>
			{(canKick || canPromote || canDemote) && (
				<ContextMenuContent className="w-48">
					{canPromote && (
						<ContextMenuItem 
							className="gap-2"
							onClick={() => onUpdateRole(member.id, 10)}
						>
							<Shield size={16} className="text-blue-400" />
							Promote to Admin
						</ContextMenuItem>
					)}
					{canDemote && (
						<ContextMenuItem 
							className="gap-2"
							onClick={() => onUpdateRole(member.id, 0)}
						>
							<UserMinus size={16} className="text-muted-foreground" />
							Demote to Member
						</ContextMenuItem>
					)}
					{canKick && (
						<>
							<ContextMenuSeparator />
							<ContextMenuItem 
								className="text-destructive focus:text-destructive focus:bg-destructive/10 font-bold gap-2"
								onClick={() => onKick(member)}
							>
								<UserMinus size={16} />
								Kick Member
							</ContextMenuItem>
						</>
					)}
				</ContextMenuContent>
			)}
		</ContextMenu>
	);
};
