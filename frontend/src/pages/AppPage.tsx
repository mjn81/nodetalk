import { useStore } from '@/store/useStore';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/components/ui/resizable';
import LeftSidebar from '@/components/Layout/LeftSidebar';
import RightSidebar from '@/components/Layout/RightSidebar';
import ChatArea from '@/components/ChatArea';

export default function AppPage() {
	const activeChannel = useStore((state) => state.activeChannel);

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
				className="bg-secondary flex flex-col border-r border-[#1e1f22]"
			>
				<LeftSidebar />
			</ResizablePanel>

			<ResizableHandle withHandle className="bg-[#1e1f22]" />

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
						<div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center text-3xl border border-[#1e1f22]">
							💬
						</div>
						<h1 className="text-xl font-bold">Welcome to NodeTalk</h1>
						<p className="text-sm text-muted-foreground max-w-sm">
							Discover public channels, or create a new group/DM on the left.
						</p>
					</div>
				)}
			</ResizablePanel>

			<ResizableHandle withHandle className="bg-[#1e1f22]" />

			{/* Right Sidebar Pane */}
			<ResizablePanel
				defaultSize={250}
				minSize={200}
				maxSize={300}
				className="bg-secondary flex flex-col border-l border-[#1e1f22]"
			>
				<RightSidebar />
			</ResizablePanel>
		</ResizablePanelGroup>
	);
}
