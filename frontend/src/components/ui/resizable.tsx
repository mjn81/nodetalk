import { GripVertical } from 'lucide-react';
import { Group, Panel, Separator } from 'react-resizable-panels';

import { cn } from '@/lib/utils';

const ResizablePanelGroup = ({
	className,
	direction,
	...props
}: React.ComponentProps<typeof Group> & {
	direction?: 'horizontal' | 'vertical';
}) => (
	<Group
		orientation={direction}
		className={cn(
			'flex h-full w-full data-[panel-group-direction=vertical]:flex-col',
			className,
		)}
		{...props}
	/>
);

const ResizablePanel = Panel;

const ResizableHandle = ({
	withHandle,
	className,
	...props
}: React.ComponentProps<typeof Separator> & {
	withHandle?: boolean;
}) => (
	<Separator
		className={cn(
			'relative flex w-2 items-center justify-center bg-border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 z-10 cursor-col-resize hover:w-2 transition-all group',
			className,
		)}
		{...props}
	>
		{withHandle && (
			<div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-[#1e1f22] absolute">
				<GripVertical className="h-2.5 w-2.5 text-[#949ba4]" />
			</div>
		)}
	</Separator>
);

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
