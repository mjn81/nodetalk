import { useState, useEffect, useRef } from 'react';
import { useAuthStore, useChannelStore } from '@/store/store';
import { apiSearchUsers } from '@/api/client';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MessageSquare, Users, Search } from 'lucide-react';
import { Avatar as MinidenticonAvatar } from '@/components/Avatar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface NewChannelModalProps {
	initialTab?: 'dm' | 'channel';
	onClose: () => void;
}

export default function NewChannelModal({ initialTab = 'dm', onClose }: NewChannelModalProps) {
	const user = useAuthStore((state) => state.user);
	const createChannel = useChannelStore((state) => state.createChannel);
	const setActiveChannel = useChannelStore((state) => state.setActiveChannel);

	const [mode, setMode] = useState<'dm' | 'group'>(initialTab === 'channel' ? 'group' : 'dm');
	const [name, setName] = useState('');
	
	// DM Search state
	const [searchQuery, setSearchQuery] = useState('');
	const [searchResults, setSearchResults] = useState<Array<{ id: string; username: string }>>([]);
	const [isSearching, setIsSearching] = useState(false);
	
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);

	const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

	const trimmedQuery = searchQuery.trim();

	useEffect(() => {
		if (mode !== 'dm') return;
		if (!trimmedQuery) return;

		if (searchTimeout.current) clearTimeout(searchTimeout.current);

		searchTimeout.current = setTimeout(async () => {
			setIsSearching(true);

			try {
				const results = await apiSearchUsers(trimmedQuery);
				const filtered = results.filter((u) => u.username !== user?.username);
				setSearchResults(filtered);
			} catch (err) {
				console.error(err);
			} finally {
				setIsSearching(false);
			}
		}, 300);

		return () => {
			if (searchTimeout.current) clearTimeout(searchTimeout.current);
		};
	}, [trimmedQuery, mode, user]);


	const handleCreateGroup = async () => {
		setError('');
		if (!name.trim()) {
			setError('Group name is required');
			return;
		}

		setLoading(true);
		try {
			const ch = await createChannel(name.trim(), [user!.username]);
			setActiveChannel(ch);
			onClose();
		} catch (e: unknown) {
			setError((e as Error).message ?? 'Failed to create conversation');
		} finally {
			setLoading(false);
		}
	};

	const handleCreateDM = async (targetUsername: string) => {
		setError('');
		setLoading(true);
		try {
			const ch = await createChannel('', [user!.username, targetUsername]);
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
							className={`flex-1 flex gap-2 items-center h-9 transition-colors rounded-md ${mode === 'group' ? 'bg-[#4752c4] text-white hover:bg-[#4752c4]' : 'bg-transparent text-[#b5bac1] hover:bg-[#35373c] hover:text-[#dbdee1]'}`}
							onClick={() => setMode('group')}
						>
							<Users size={16} />
							Group
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
										<div className="p-4 text-center text-sm text-[#949ba4]">Searching...</div>
									) : searchResults.length > 0 ? (
										<div className="py-2">
											{searchResults.map(u => (
												<div 
													key={u.id}
													onClick={() => handleCreateDM(u.username)}
													className="flex items-center gap-3 px-3 py-2 hover:bg-[#3f4147] cursor-pointer transition-colors"
												>
													<Avatar className="w-8 h-8">
														<AvatarFallback className="bg-transparent overflow-hidden">
															<MinidenticonAvatar userId={u.id} size={32} />
														</AvatarFallback>
													</Avatar>
													<div className="flex flex-col flex-1">
														<span className="text-sm font-bold text-white">{u.username}</span>
													</div>
												</div>
											))}
										</div>
									) : searchQuery.trim() !== '' ? (
										<div className="p-4 text-center text-sm text-[#949ba4]">No users found.</div>
									) : (
										<div className="p-4 text-center text-sm text-[#949ba4]">Start typing to find someone.</div>
									)}
								</div>
							</div>
						)}

						{mode === 'group' && (
							<div className="space-y-2 pb-4">
								<Label
									htmlFor="group-name"
									className="text-xs uppercase font-bold text-[#b5bac1]"
								>
									Group Name
								</Label>
								<Input
									id="group-name"
									className="bg-[#1e1f22] border-none text-[15px] h-10 text-[#dbdee1] focus-visible:ring-0 focus-visible:ring-offset-0"
									placeholder="e.g. Design Team"
									value={name}
									onChange={(e) => setName(e.target.value)}
									autoFocus
								/>
							</div>
						)}

						{error && (
							<div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md border border-destructive/20 mt-2">
								{error}
							</div>
						)}
					</div>
				</div>

				<div className={`p-4 bg-[#2b2d31] border-t border-[#1e1f22] flex justify-end gap-3 ${mode === 'dm' ? 'hidden' : ''}`}>
					<Button
						variant="link"
						className="text-[#949ba4] hover:text-[#dbdee1]"
						onClick={onClose}
					>
						Cancel
					</Button>
					<Button
						disabled={loading}
						onClick={handleCreateGroup}
						className="bg-[#5865F2] hover:bg-[#4752c4] text-white"
					>
						{loading ? <span className="spinner" /> : 'Create'}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
