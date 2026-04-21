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
			'relative flex w-px items-center justify-center bg-border z-50 cursor-col-resize after:absolute after:inset-y-0 after:left-1/2 after:w-[10px] after:-translate-x-1/2 focus-visible:outline-none',
			className,
		)}
		{...props}
	/>
);

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
