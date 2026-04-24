import React, { useState, useEffect, useCallback } from 'react';
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
import { Trash2, Copy, Check, Lock, Globe, Search, UserPlus, X, Loader2 } from 'lucide-react';
import { type Channel, type User } from '@/types/api';
import { apiUpdateChannel, apiDeleteChannel, apiSearchUsers, apiAddMember } from '@/api/client';
import { useChannelStore } from '@/store/store';
import { Avatar } from '../Avatar';
import { ConfirmModal } from '../ConfirmModal';

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
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

	// Member Addition State
	const [searchTerm, setSearchTerm] = useState('');
	const [searchResults, setSearchResults] = useState<User[]>([]);
	const [isSearching, setIsSearching] = useState(false);
	const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
	const [isAddingMembers, setIsAddingMembers] = useState(false);

	const isAdmin = channel.user_role >= 10;
	const isOwner = channel.user_role >= 20;

	// Search logic
	useEffect(() => {
		if (searchTerm.length < 2) {
			setSearchResults([]);
			return;
		}

		const delay = setTimeout(async () => {
			setIsSearching(true);
			try {
				const results = await apiSearchUsers(searchTerm);
				// Filter out users who are already in the channel
				const filtered = results.filter(u => !channel.members.includes(u.id));
				setSearchResults(filtered);
			} catch (err) {
				console.error('Search failed:', err);
			} finally {
				setIsSearching(false);
			}
		}, 500);

		return () => clearTimeout(delay);
	}, [searchTerm, channel.members]);

	const handleAddMember = (user: User) => {
		if (selectedUsers.find(u => u.id === user.id)) return;
		setSelectedUsers([...selectedUsers, user]);
		setSearchTerm('');
		setSearchResults([]);
	};

	const removeSelected = (userId: string) => {
		setSelectedUsers(selectedUsers.filter(u => u.id !== userId));
	};

	const submitAddMembers = async () => {
		if (selectedUsers.length === 0) return;
		setIsAddingMembers(true);
		try {
			await apiAddMember(channel.id, selectedUsers.map(u => u.id));
			await refreshChannels();
			setSelectedUsers([]);
			// Optionally show success or just stay open
		} catch (err) {
			console.error('Failed to add members:', err);
		} finally {
			setIsAddingMembers(false);
		}
	};

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

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="bg-background text-foreground border-border max-w-lg rounded-xl overflow-y-auto max-h-[90vh]">
				<DialogHeader>
					<DialogTitle className="text-xl font-bold">
						Channel Settings
					</DialogTitle>
					<DialogDescription className="text-muted-foreground text-sm">
						Manage your channel's details and permissions.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-6 py-4">
					{/* Group Name & Status */}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						<div className="space-y-2">
							<Label htmlFor="name" className="text-xs uppercase font-bold text-muted-foreground tracking-wider">Channel Name</Label>
							<Input
								id="name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="Enter group name..."
								className="bg-secondary/50 border-border focus:ring-primary h-10"
							/>
						</div>

						<div className="space-y-2">
							<Label className="text-xs uppercase font-bold text-muted-foreground tracking-wider">Privacy</Label>
							<div className="flex gap-2">
								<Button
									variant={isPrivate ? 'default' : 'outline'}
									className="flex-1 gap-2 h-10 text-xs"
									onClick={() => setIsPrivate(true)}
								>
									<Lock size={14} /> Private
								</Button>
								<Button
									variant={!isPrivate ? 'default' : 'outline'}
									className="flex-1 gap-2 h-10 text-xs"
									onClick={() => setIsPrivate(false)}
								>
									<Globe size={14} /> Public
								</Button>
							</div>
						</div>
					</div>

					{/* Add Members Section - Admin Only */}
					{isAdmin && (
						<div className="space-y-3 pt-2 border-t border-border/50">
							<Label className="text-xs uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-2">
								<UserPlus size={14} /> Add Members
							</Label>
							
							<div className="relative">
								<div className="relative">
									<Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
									<Input
										value={searchTerm}
										onChange={(e) => setSearchTerm(e.target.value)}
										placeholder="Search by username..."
										className="pl-10 bg-secondary/30 border-border h-10"
									/>
									{isSearching && (
										<Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-primary" size={16} />
									)}
								</div>

								{/* Search Results Dropdown */}
								{searchResults.length > 0 && (
									<div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
										{searchResults.map(u => (
											<button
												key={u.id}
												onClick={() => handleAddMember(u)}
												className="w-full flex items-center gap-3 p-2 hover:bg-accent transition-colors border-b last:border-0 border-border/50"
											>
												<Avatar userId={u.id} avatarId={u.avatar_id} size={32} />
												<div className="flex flex-col items-start">
													<span className="text-sm font-bold">{u.username}</span>
													<span className="text-[10px] text-muted-foreground">@{u.domain}</span>
												</div>
											</button>
										))}
									</div>
								)}
							</div>

							{/* Selected Users Chips */}
							{selectedUsers.length > 0 && (
								<div className="flex flex-wrap gap-2 p-2 bg-secondary/20 rounded-lg border border-dashed border-border/50">
									{selectedUsers.map(u => (
										<div key={u.id} className="flex items-center gap-2 bg-accent/50 pl-1 pr-2 py-1 rounded-md border border-accent">
											<Avatar userId={u.id} avatarId={u.avatar_id} size={20} />
											<span className="text-xs font-medium">{u.username}</span>
											<button 
												onClick={() => removeSelected(u.id)}
												className="hover:text-destructive transition-colors"
											>
												<X size={14} />
											</button>
										</div>
									))}
									<Button 
										size="sm" 
										className="ml-auto h-7 text-[10px] font-bold px-3"
										onClick={submitAddMembers}
										disabled={isAddingMembers}
									>
										{isAddingMembers ? (
											<Loader2 size={12} className="animate-spin mr-1" />
										) : (
											<UserPlus size={12} className="mr-1" />
										)}
										Add {selectedUsers.length} Member{selectedUsers.length > 1 ? 's' : ''}
									</Button>
								</div>
							)}
						</div>
					)}

					{/* Join Link */}
					{channel.invite_link && (
						<div className="space-y-2 pt-2 border-t border-border/50">
							<Label className="text-xs uppercase font-bold text-muted-foreground tracking-wider">Invite Link</Label>
							<div className="flex gap-2">
								<Input
									readOnly
									value={fullInviteLink}
									className="bg-secondary/30 border-border font-mono text-xs h-9"
								/>
								<Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={copyLink}>
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
							className="w-full font-bold h-11"
						>
							{loading ? 'Saving...' : 'Save Settings'}
						</Button>

						{isOwner && (
							<div className="pt-2">
								<Button
									variant="ghost"
									className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive font-bold gap-2 text-xs"
									onClick={() => setShowDeleteConfirm(true)}
									disabled={loading}
								>
									<Trash2 size={14} /> Delete Channel
								</Button>

								<ConfirmModal
									isOpen={showDeleteConfirm}
									onClose={() => setShowDeleteConfirm(false)}
									onConfirm={handleDelete}
									title="Delete Channel"
									message={`Are you sure you want to delete "${channel.name}"? All messages and data associated with this channel will be permanently removed. This action cannot be undone.`}
									confirmText="Delete Channel"
									variant="danger"
								/>
							</div>
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
};
