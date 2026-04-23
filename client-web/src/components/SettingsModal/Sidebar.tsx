import { useTranslation } from 'react-i18next';
import { User, Shield, Palette, Bell, LogOut } from 'lucide-react';
import { useAuthStore } from '@/store/store';
import { TabButton } from './TabButton';
import type { SettingsTab } from './types';

interface SidebarProps {
	activeTab: SettingsTab;
	setActiveTab: (tab: SettingsTab) => void;
}

export const Sidebar = ({ activeTab, setActiveTab }: SidebarProps) => {
	const { t } = useTranslation();
	const logout = useAuthStore((state) => state.logout);

	return (
		<div className="w-[220px] bg-secondary p-4 flex flex-col pt-8 border-r border-border/50">
			<div className="space-y-6">
				<div>
					<div className="text-[11px] font-bold text-muted-foreground uppercase px-3 mb-1.5 tracking-wider">
						{t('settings.title')}
					</div>
					<div className="space-y-0.5">
						<TabButton
							id="account"
							label={t('settings.my_account')}
							icon={User}
							activeTab={activeTab}
							setActiveTab={setActiveTab}
						/>
						<TabButton
							id="privacy"
							label={t('settings.privacy')}
							icon={Shield}
							activeTab={activeTab}
							setActiveTab={setActiveTab}
						/>
					</div>
				</div>

				<div>
					<div className="text-[11px] font-bold text-muted-foreground uppercase px-3 mb-1.5 tracking-wider">
						{t('sidebar.groups')}
					</div>
					<div className="space-y-0.5">
						<TabButton
							id="appearance"
							label={t('settings.appearance')}
							icon={Palette}
							activeTab={activeTab}
							setActiveTab={setActiveTab}
						/>
						<TabButton
							id="notifications"
							label={t('settings.notifications')}
							icon={Bell}
							activeTab={activeTab}
							setActiveTab={setActiveTab}
						/>
					</div>
				</div>

				<div className="pt-4 mt-auto">
					<div className="h-[1px] bg-border mb-4 mx-2" />
					<button
						onClick={logout}
						className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-destructive hover:bg-destructive/10 transition-all text-sm font-medium"
					>
						<LogOut size={18} />
						{t('settings.logout')}
					</button>
				</div>
			</div>
		</div>
	);
};
