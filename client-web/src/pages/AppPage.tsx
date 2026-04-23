import { useEffect, useState } from 'react';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/components/ui/resizable';
import LeftSidebar from '@/components/Layout/LeftSidebar';
import RightSidebar from '@/components/Layout/RightSidebar';
import ChatArea from '@/components/ChatArea';

import { useChannelStore } from '@/store/store';
import { onWS } from '@/ws';
import { ensureZstdReady } from '@/utils/file';
import { requestNotificationPermission } from '@/utils/notifications';

import { apiJoinChannel } from '@/api/client';

export default function AppPage() {
	const activeChannel = useChannelStore((state) => state.activeChannel);
	const refreshChannels = useChannelStore((state) => state.refreshChannels);
	const setActiveChannel = useChannelStore((state) => state.setActiveChannel);

	useEffect(() => {
		const path = window.location.pathname;
		if (path.startsWith('/join/')) {
			const code = path.split('/join/')[1];
			if (code) {
				const autoJoin = async () => {
					try {
						const res = await apiJoinChannel(code);
						await refreshChannels();
						// Remove join from URL
						window.history.replaceState({}, '', '/');
						// Find newly joined channel in the refreshed list
						const allChannels = useChannelStore.getState().channels;
						const ch = allChannels.find((c) => c.id === res.id);
						if (ch) setActiveChannel(ch);
					} catch (err) {
						console.error('Auto-join failed:', err);
						window.history.replaceState({}, '', '/');
					}
				};
				autoJoin();
			}
		}
	}, []);

	useEffect(() => {
		// Initialize ZSTD WASM once on app load
		ensureZstdReady();
		requestNotificationPermission();

		// Listen for realtime channel state updates (e.g. member joins)
		const unsubChannel = onWS('channel_update', () => {
			refreshChannels();
		});

		return () => {
			unsubChannel();
		};
	}, [refreshChannels]);

	const [isRightCollapsed, setIsRightCollapsed] = useState(false);

	return (
		<ResizablePanelGroup
			direction="horizontal"
			className="h-screen w-full bg-background overflow-hidden"
		>
			{/* Left Sidebar Pane */}
			<ResizablePanel
				defaultSize="20%"
				minSize="15%"
				maxSize="20%"
				className="bg-secondary flex flex-col border-r border-border overflow-hidden"
			>
				<LeftSidebar />
			</ResizablePanel>

			<ResizableHandle withHandle className="bg-border" />

			{/* Center Chat Pane */}
			<ResizablePanel
				minSize="40%"
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

			<ResizablePanel
				defaultSize="20%"
				minSize="15%"
				maxSize="25%"
				collapsible={true}
				collapsedSize="64px"
				onResize={(panelSize) => setIsRightCollapsed(panelSize.inPixels <= 64)}
				className="bg-secondary flex flex-col border-l border-border transition-all duration-300 ease-in-out"
			>
				<RightSidebar isCollapsed={isRightCollapsed} />
			</ResizablePanel>
		</ResizablePanelGroup>
	);
}
