import type { LucideIcon } from 'lucide-react';
import type { SettingsTab } from './types';

interface TabButtonProps {
	id: SettingsTab;
	label: string;
	icon: LucideIcon;
	activeTab: SettingsTab;
	setActiveTab: (id: SettingsTab) => void;
}

export const TabButton = ({
	id,
	label,
	icon: Icon,
	activeTab,
	setActiveTab,
}: TabButtonProps) => (
	<button
		onClick={() => setActiveTab(id)}
		className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md transition-all text-sm font-medium ${
			activeTab === id
				? 'bg-accent text-accent-foreground shadow-sm'
				: 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
		}`}
	>
		<Icon
			size={18}
			className={
				activeTab === id ? 'text-accent-foreground' : 'text-muted-foreground'
			}
		/>
		{label}
	</button>
);
