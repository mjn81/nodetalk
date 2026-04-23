import React, { useState } from 'react';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Copy, Check, Lock, Globe } from 'lucide-react';
import { type Channel } from '@/types/api';
import { apiUpdateChannel, apiDeleteChannel } from '@/api/client';
import { useChannelStore } from '@/store/store';

interface GroupSettingsModalProps {
	channel: Channel;
	onClose: () => void;
}

export const GroupSettingsModal: React.FC<GroupSettingsModalProps> = ({
	channel,
	onClose,
}) => {
	const refreshChannels = useChannelStore((state) => state.refreshChannels);
	const setActiveChannel = useChannelStore((state) => state.setActiveChannel);
	const [name, setName] = useState(channel.name);
	const [isPrivate, setIsPrivate] = useState(channel.is_private);
	const [loading, setLoading] = useState(false);
	const [copied, setCopied] = useState(false);

	const handleSave = async () => {
		const trimmedName = name.trim();
		if (!trimmedName) return;

		setLoading(true);
		try {
			await apiUpdateChannel(channel.id, {
				name: trimmedName,
				is_private: isPrivate,
			});
			await refreshChannels();
			onClose();
		} catch (err) {
			console.error('Failed to update channel:', err);
		} finally {
			setLoading(false);
		}
	};

	const handleDelete = async () => {
		if (
			!window.confirm(
				'Are you sure you want to delete this group? This action cannot be undone.',
			)
		) {
			return;
		}

		setLoading(true);
		try {
			await apiDeleteChannel(channel.id);
			setActiveChannel(null);
			await refreshChannels();
			onClose();
		} catch (err) {
			console.error('Failed to delete channel:', err);
		} finally {
			setLoading(false);
		}
	};

	const fullInviteLink = `${window.location.origin}/join/${channel.invite_link}`;

	const copyLink = () => {
		if (channel.invite_link) {
			navigator.clipboard.writeText(fullInviteLink);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	};

	const isOwner = channel.user_role >= 20;

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="bg-background text-foreground border-border max-w-md rounded-xl">
				<DialogHeader>
					<DialogTitle className="text-xl font-bold">
						Channel Settings
					</DialogTitle>
					<DialogDescription className="text-muted-foreground">
						Manage your channel's details and permissions.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-6 py-4">
					{/* Group Name */}
					<div className="space-y-2">
						<Label htmlFor="name">Channel Name</Label>
						<Input
							id="name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Enter group name..."
							className="bg-secondary/50 border-border focus:ring-primary"
						/>
					</div>

					{/* Visibility / Status */}
					<div className="space-y-3">
						<Label>Channel Status</Label>
						<div className="flex gap-2">
							<Button
								variant={isPrivate ? 'default' : 'outline'}
								className="flex-1 gap-2"
								onClick={() => setIsPrivate(true)}
							>
								<Lock size={16} /> Private
							</Button>
							<Button
								variant={!isPrivate ? 'default' : 'outline'}
								className="flex-1 gap-2"
								onClick={() => setIsPrivate(false)}
							>
								<Globe size={16} /> Public
							</Button>
						</div>
						<p className="text-[11px] text-muted-foreground px-1">
							{isPrivate
								? 'Only invited members can find and join this channel.'
								: 'Anyone can find and join this channel through the explorer.'}
						</p>
					</div>

					{/* Join Link */}
					{channel.invite_link && (
						<div className="space-y-2">
							<Label>Invite Link</Label>
							<div className="flex gap-2">
								<Input
									readOnly
									value={fullInviteLink}
									className="bg-secondary/30 border-border font-mono text-xs"
								/>
								<Button size="icon" variant="outline" onClick={copyLink}>
									{copied ? (
										<Check size={16} className="text-green-500" />
									) : (
										<Copy size={16} />
									)}
								</Button>
							</div>
						</div>
					)}

					{/* Actions */}
					<div className="pt-4 flex flex-col gap-3">
						<Button
							onClick={handleSave}
							disabled={loading || !name.trim()}
							className="w-full font-bold"
						>
							{loading ? 'Saving...' : 'Save Changes'}
						</Button>

						{isOwner && (
							<Button
								variant="ghost"
								className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive font-bold gap-2"
								onClick={handleDelete}
								disabled={loading}
							>
								<Trash2 size={16} /> Delete Channel
							</Button>
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
};
