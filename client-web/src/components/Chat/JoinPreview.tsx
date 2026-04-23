import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Users, UserPlus } from 'lucide-react';
import { apiJoinChannel } from '@/api/client';
import { useChannelStore } from '@/store/store';

interface JoinPreviewProps {
	inviteCode: string;
}

export const JoinPreview: React.FC<JoinPreviewProps> = ({ inviteCode }) => {
	const [loading, setLoading] = useState(false);
	const [joined, setJoined] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const refreshChannels = useChannelStore((state) => state.refreshChannels);
	const setActiveChannel = useChannelStore((state) => state.setActiveChannel);
	const handleJoin = async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await apiJoinChannel(inviteCode);
			setJoined(true);
			await refreshChannels();

			// Find the newly joined channel and navigate to it
			const allChannels = useChannelStore.getState().channels;
			const newCh = allChannels.find((c) => c.id === res.id);
			if (newCh) {
				setActiveChannel(newCh);
			}
		} catch (err: any) {
			setError(err.response?.data?.error || 'Failed to join group');
		} finally {
			setLoading(false);
		}
	};

	return (
		<Card className="mt-2 p-4 bg-secondary/30 border-primary/20 flex flex-col gap-3 max-w-sm">
			<div className="flex items-start gap-3">
				<div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
					<Users size={20} />
				</div>
				<div className="flex flex-col min-w-0">
					<span className="text-sm font-bold text-foreground truncate">
						Channel Invitation
					</span>
					<span className="text-xs text-muted-foreground truncate">
						You've been invited to join a group
					</span>
				</div>
			</div>

			{error && (
				<span className="text-[11px] text-destructive font-medium px-1">
					{error}
				</span>
			)}

			<Button
				size="sm"
				onClick={handleJoin}
				disabled={loading || joined}
				className="w-full gap-2 font-bold"
			>
				{joined ? (
					'Joined'
				) : (
					<>
						<UserPlus size={16} />
						{loading ? 'Joining...' : 'Join Channel'}
					</>
				)}
			</Button>
		</Card>
	);
};
