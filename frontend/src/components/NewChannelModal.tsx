import { useState } from 'react';
import { useStore } from '@/store/useStore';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MessageSquare, Users } from 'lucide-react';

interface NewChannelModalProps {
	onClose: () => void;
}

export default function NewChannelModal({ onClose }: NewChannelModalProps) {
	const user = useStore((state) => state.user);
	const createChannel = useStore((state) => state.createChannel);
	const setActiveChannel = useStore((state) => state.setActiveChannel);

	const [mode, setMode] = useState<'dm' | 'group'>('dm');
	const [name, setName] = useState('');
	const [memberId, setMemberId] = useState('');
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);

	const handleCreate = async () => {
		setError('');
		// Ensure we have values
		if (mode === 'dm' && !memberId.trim()) {
			setError('Enter a username to message');
			return;
		}
		if (mode === 'group' && !name.trim()) {
			setError('Group name is required');
			return;
		}

		setLoading(true);
		try {
			// For api we are sending username for DM instead of user_id now per user request.
			// Assuming members can be array of usernames that the backend resolves.
			const members =
				mode === 'dm' ? [user!.username, memberId.trim()] : [user!.username];

			const ch = await createChannel(
				mode === 'group' ? name.trim() : '',
				members,
			);
			setActiveChannel(ch);
			onClose();
		} catch (e: unknown) {
			setError((e as Error).message ?? 'Failed to create conversation');
		} finally {
			setLoading(false);
		}
	};

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="bg-[#313338] border-none text-[#dbdee1] sm:max-w-[440px]">
				<DialogHeader>
					<DialogTitle className="text-xl font-bold text-white text-center">
						New Conversation
					</DialogTitle>
				</DialogHeader>

				<div className="flex gap-2 mb-4">
					<Button
						variant="ghost"
						className={`flex-1 flex gap-2 items-center h-10 transition-colors ${mode === 'dm' ? 'bg-[#4752c4] text-white hover:bg-[#4752c4]' : 'bg-[#2b2d31] text-[#b5bac1] hover:bg-[#35373c] hover:text-[#dbdee1]'}`}
						onClick={() => setMode('dm')}
					>
						<MessageSquare size={18} />
						Direct Message
					</Button>
					<Button
						variant="ghost"
						className={`flex-1 flex gap-2 items-center h-10 transition-colors ${mode === 'group' ? 'bg-[#4752c4] text-white hover:bg-[#4752c4]' : 'bg-[#2b2d31] text-[#b5bac1] hover:bg-[#35373c] hover:text-[#dbdee1]'}`}
						onClick={() => setMode('group')}
					>
						<Users size={18} />
						Group
					</Button>
				</div>

				<div className="space-y-4">
					{mode === 'dm' && (
						<div className="space-y-2">
							<Label
								htmlFor="dm-user-name"
								className="text-xs uppercase font-bold text-[#b5bac1]"
							>
								Username
							</Label>
							<Input
								id="dm-user-name"
								className="bg-[#1e1f22] border-none text-[15px] h-10 text-[#dbdee1] focus-visible:ring-0 focus-visible:ring-offset-0"
								placeholder="Enter exact username..."
								value={memberId}
								onChange={(e) => setMemberId(e.target.value)}
								autoFocus
							/>
						</div>
					)}

					{mode === 'group' && (
						<div className="space-y-2">
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

				<div className="flex justify-end gap-3 mt-6">
					<Button
						variant="link"
						className="text-[#949ba4] hover:text-[#dbdee1]"
						onClick={onClose}
					>
						Cancel
					</Button>
					<Button
						disabled={loading}
						onClick={handleCreate}
						className="bg-primary hover:bg-[#4752c4] text-white"
					>
						{loading ? <span className="spinner" /> : 'Create'}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
