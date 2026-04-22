import { useState, useEffect } from 'react';
import { useUserSearch } from '@/hooks/useUsers';
import { useAuthStore, useChannelStore } from '@/store/store';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MessageSquare, Hash, Search, Lock, Globe } from 'lucide-react';
import { Avatar as MinidenticonAvatar } from '@/components/Avatar';

interface NewChannelModalProps {
	initialTab?: 'dm' | 'channel';
	onClose: () => void;
}

export default function NewChannelModal({
	initialTab = 'dm',
	onClose,
}: NewChannelModalProps) {
	const user = useAuthStore((state) => state.user);
	const createChannel = useChannelStore((state) => state.createChannel);
	const setActiveChannel = useChannelStore((state) => state.setActiveChannel);

	const [mode, setMode] = useState<'dm' | 'channel'>(
		initialTab === 'channel' ? 'channel' : 'dm',
	);
	const [name, setName] = useState('');
	const [isPrivate, setIsPrivate] = useState(true);

	// DM Search state
	const [searchQuery, setSearchQuery] = useState('');
	const [debouncedQuery, setDebouncedQuery] = useState('');

	useEffect(() => {
		const handler = setTimeout(() => {
			setDebouncedQuery(searchQuery.trim());
		}, 300);
		return () => clearTimeout(handler);
	}, [searchQuery]);

	const { data: searchResults = [], isFetching: isSearching } = useUserSearch(
		debouncedQuery,
		user?.username,
	);

	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);

	const handleCreateChannel = async () => {
		setError('');
		if (!name.trim()) {
			setError('Channel name is required');
			return;
		}

		setLoading(true);
		try {
			const ch = await createChannel(name.trim(), [user!.id], isPrivate);
			setActiveChannel(ch);
			onClose();
		} catch (e: unknown) {
			setError((e as Error).message ?? 'Failed to create channel');
		} finally {
			setLoading(false);
		}
	};

	const handleCreateDM = async (targetId: string) => {
		setError('');
		setLoading(true);
		try {
			const ch = await createChannel('', [user!.id, targetId], true);
			setActiveChannel(ch);
			onClose();
		} catch (e: unknown) {
			setError((e as Error).message ?? 'Failed to start direct message');
		} finally {
			setLoading(false);
		}
	};

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="bg-[#313338] border-none text-[#dbdee1] sm:max-w-[440px] p-0 overflow-hidden shadow-2xl">
				<div className="p-6">
					<DialogHeader>
						<DialogTitle className="text-xl font-bold text-white text-center mb-2">
							New Conversation
						</DialogTitle>
					</DialogHeader>

					<div className="flex gap-2 mb-4 bg-[#2b2d31] p-1 rounded-lg">
						<Button
							variant="ghost"
							className={`flex-1 flex gap-2 items-center h-9 transition-colors rounded-md ${mode === 'dm' ? 'bg-[#4752c4] text-white hover:bg-[#4752c4]' : 'bg-transparent text-[#b5bac1] hover:bg-[#35373c] hover:text-[#dbdee1]'}`}
							onClick={() => setMode('dm')}
						>
							<MessageSquare size={16} />
							Direct Message
						</Button>
						<Button
							variant="ghost"
							className={`flex-1 flex gap-2 items-center h-9 transition-colors rounded-md ${mode === 'channel' ? 'bg-[#4752c4] text-white hover:bg-[#4752c4]' : 'bg-transparent text-[#b5bac1] hover:bg-[#35373c] hover:text-[#dbdee1]'}`}
							onClick={() => setMode('channel')}
						>
							<Hash size={16} />
							Channel
						</Button>
					</div>

					<div className="space-y-4">
						{mode === 'dm' && (
							<div className="space-y-3">
								<div className="relative">
									<Input
										id="dm-user-search"
										className="bg-[#1e1f22] border-none text-[15px] h-12 pl-10 text-[#dbdee1] focus-visible:ring-0 rounded-md"
										placeholder="Search for a username..."
										value={searchQuery}
										onChange={(e) => setSearchQuery(e.target.value)}
										autoFocus
										autoComplete="off"
									/>
									<Search className="absolute left-3 top-3.5 w-5 h-5 text-[#949ba4]" />
								</div>

								{/* Search Results Dropdown */}
								<div className="bg-[#2b2d31] rounded-md overflow-hidden min-h-[50px] max-h-[220px] overflow-y-auto">
									{isSearching ? (
										<div className="p-4 text-center text-sm text-[#949ba4]">
											Searching...
										</div>
									) : searchResults.length > 0 ? (
										<div className="py-2">
											{searchResults.map((u) => (
												<div
													key={u.id}
													onClick={() => handleCreateDM(u.id)}
													className="flex items-center gap-3 px-3 py-2 hover:bg-[#3f4147] cursor-pointer transition-colors"
												>
													<MinidenticonAvatar
														userId={u.id}
														avatarId={u.avatar_id}
														size={32}
													/>
													<div className="flex flex-col flex-1">
														<span className="text-sm font-bold text-white">
															{u.username}
														</span>
													</div>
												</div>
											))}
										</div>
									) : searchQuery.trim() !== '' ? (
										<div className="p-4 text-center text-sm text-[#949ba4]">
											No users found.
										</div>
									) : (
										<div className="p-4 text-center text-sm text-[#949ba4]">
											Start typing to find someone.
										</div>
									)}
								</div>
							</div>
						)}

						{mode === 'channel' && (
							<div className="space-y-4 pb-4">
								<div className="space-y-2">
									<Label
										htmlFor="channel-name"
										className="text-xs uppercase font-bold text-[#b5bac1]"
									>
										Channel Name
									</Label>
									<Input
										id="channel-name"
										className="bg-[#1e1f22] border-none text-[15px] h-10 text-[#dbdee1] focus-visible:ring-0 focus-visible:ring-offset-0"
										placeholder="e.g. Design Team"
										value={name}
										onChange={(e) => setName(e.target.value)}
										autoFocus
									/>
								</div>

								<div className="bg-[#2b2d31] rounded-md overflow-hidden">
									<div
										className="flex items-center justify-between p-3 cursor-pointer hover:bg-[#35373c] transition-colors"
										onClick={() => setIsPrivate(!isPrivate)}
									>
										<div className="flex items-center gap-3">
											{isPrivate ? (
												<Lock size={20} className="text-[#f23f42]" />
											) : (
												<Globe size={20} className="text-[#23a559]" />
											)}
											<div className="flex flex-col">
												<span className="text-sm font-bold text-white">
													{isPrivate ? 'Private Channel' : 'Public Channel'}
												</span>
												<span className="text-xs text-[#949ba4]">
													{isPrivate
														? 'Only invited members can find and join.'
														: 'Anyone can find and join this channel.'}
												</span>
											</div>
										</div>
										<div
											className={`w-10 h-5 rounded-full relative transition-colors ${isPrivate ? 'bg-[#5865F2]' : 'bg-[#4e5058]'}`}
										>
											<div
												className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isPrivate ? 'right-1' : 'left-1'}`}
											/>
										</div>
									</div>
									<div className="px-3 pb-3">
										<p className="text-[11px] text-[#949ba4] bg-[#1e1f22] p-2 rounded italic">
											{isPrivate
												? 'Note: This channel will not appear in the discoverable "Explore" list.'
												: 'Note: This channel will be visible to everyone on the server via search.'}
										</p>
									</div>
								</div>
							</div>
						)}

						{error && (
							<div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md border border-destructive/20 mt-2">
								{error}
							</div>
						)}
					</div>
				</div>

				<div
					className={`p-4 bg-[#2b2d31] border-t border-[#1e1f22] flex justify-end gap-3 ${mode === 'dm' ? 'hidden' : ''}`}
				>
					<Button
						variant="link"
						className="text-[#949ba4] hover:text-[#dbdee1]"
						onClick={onClose}
					>
						Cancel
					</Button>
					<Button
						disabled={loading || (mode === 'channel' && !name.trim())}
						onClick={handleCreateChannel}
						className="bg-[#5865F2] hover:bg-[#4752c4] text-white"
					>
						{loading ? <span className="spinner" /> : 'Create'}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
