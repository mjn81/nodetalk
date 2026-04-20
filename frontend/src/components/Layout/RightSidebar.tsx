import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { apiGetChannelMembers } from '@/api/client';
import { Avatar as MinidenticonAvatar } from '@/components/Avatar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users } from 'lucide-react';

interface Member {
	id: string;
	username: string;
	domain: string;
	status: string;
}

export default function RightSidebar() {
	const activeChannel = useStore((state) => state.activeChannel);
	const [members, setMembers] = useState<Member[]>([]);
	const [isLoading, setIsLoading] = useState(false);

	useEffect(() => {
		if (!activeChannel) {
			setMembers([]);
			return;
		}

		let cancelled = false;
		setIsLoading(true);
		apiGetChannelMembers(activeChannel.id)
			.then((res) => {
				if (!cancelled) setMembers(res);
			})
			.catch(console.error)
			.finally(() => {
				if (!cancelled) setIsLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [activeChannel]);

	if (!activeChannel) {
		return <div className="h-full bg-[#2b2d31]"></div>;
	}

	// Discord typically separates Online from Offline members.
	const onlineMembers = members.filter((m) => m.status === 'online');
	const offlineMembers = members.filter((m) => m.status !== 'online');

	const MemberRow = ({ member }: { member: Member }) => (
		<div
			key={member.id}
			className="flex items-center gap-3 px-2 py-1 mx-2 rounded-md cursor-pointer transition hover:bg-[#35373c] group"
		>
			<Avatar className="w-8 h-8 shrink-0 relative">
				<AvatarFallback className="bg-transparent">
					<MinidenticonAvatar userId={member.id} size={32} />
				</AvatarFallback>
				<div
					className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-[3px] border-[#2b2d31] group-hover:border-[#35373c] transition-colors ${member.status === 'online' ? 'bg-green-500' : 'bg-gray-500'}`}
				/>
			</Avatar>
			<div className="flex flex-col flex-1 min-w-0">
				<span
					className={`text-[15px] font-medium leading-tight truncate ${member.status === 'online' ? 'text-[#f2f3f5]' : 'text-[#80848E]'}`}
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
