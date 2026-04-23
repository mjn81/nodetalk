import { useEffect } from 'react';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/components/ui/resizable';
import LeftSidebar from '@/components/Layout/LeftSidebar';
import RightSidebar from '@/components/Layout/RightSidebar';
import ChatArea from '@/components/ChatArea';


import { useChannelStore, useAuthStore } from '@/store/store';
import { onWS } from '@/ws';
import { ensureZstdReady } from '@/utils/file';

export default function AppPage() {
	const activeChannel = useChannelStore((state) => state.activeChannel);
	const refreshChannels = useChannelStore((state) => state.refreshChannels);

	useEffect(() => {
		// Initialize ZSTD WASM once on app load
		ensureZstdReady();

		// Listen for realtime channel state updates (e.g. member joins)
		const unsubChannel = onWS('channel_update', () => {
			refreshChannels();
		});

		// Listen for presence updates
		const unsubPresence = onWS('presence', (payload: any) => {
			if (payload && payload.user_id && payload.status) {
				const { user } = useAuthStore.getState();
				if (user && payload.user_id === user.id) {
					useAuthStore.getState().updateStatus(payload.status);
				}
				useChannelStore.getState().updateMemberStatus(payload.user_id, payload.status);
			}
		});

		return () => {
			unsubChannel();
			unsubPresence();
		};
	}, [refreshChannels]);

	return (
		<ResizablePanelGroup
			direction="horizontal"
			className="h-screen w-full bg-background overflow-hidden"
		>
			{/* Left Sidebar Pane */}
			<ResizablePanel
				defaultSize={250}
				minSize={200}
				maxSize={300}
				className="bg-secondary flex flex-col border-r border-border"
			>
				<LeftSidebar />
			</ResizablePanel>

			<ResizableHandle withHandle className="bg-border" />

			{/* Center Chat Pane */}
			<ResizablePanel
				defaultSize={60}
				minSize={40}
				className="flex flex-col bg-background relative"
			>
				{activeChannel ? (
					<ChatArea channel={activeChannel} />
				) : (
					<div className="flex flex-col items-center justify-center flex-1 gap-4 text-center p-10">
						<div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center text-3xl border border-border">
							💬
						</div>
						<h1 className="text-xl font-bold">Welcome to NodeTalk</h1>
						<p className="text-sm text-muted-foreground max-w-sm">
							Discover public channels, or create a new group/DM on the left.
						</p>
					</div>
				)}
			</ResizablePanel>

			<ResizableHandle withHandle className="bg-border" />

			{/* Right Sidebar Pane */}
			<ResizablePanel
				defaultSize={250}
				minSize={200}
				maxSize={300}
				className="bg-secondary flex flex-col border-l border-border"
			>
				<RightSidebar />
			</ResizablePanel>
		</ResizablePanelGroup>
	);
}
