import { useTranslation } from 'react-i18next';
import { User, Shield, Palette, Bell, LogOut, Mic } from 'lucide-react';
import { useAuthStore } from '@/store/store';
import { TabButton } from './TabButton';
import type { SettingsTab } from './types';

interface SidebarProps {
	activeTab: SettingsTab;
	setActiveTab: (tab: SettingsTab) => void;
	isMobile?: boolean;
}

import { useState } from 'react';
import { ConfirmModal } from '../ConfirmModal';

export const Sidebar = ({ activeTab, setActiveTab, isMobile }: SidebarProps) => {
	const { t } = useTranslation();
	const logout = useAuthStore((state) => state.logout);
	const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

	return (
		<div className={`${isMobile ? 'w-full px-6' : 'w-[220px] border-r border-border/50 px-4'} bg-secondary flex flex-col pt-8 h-full ${isMobile ? 'pt-safe' : ''}`}>
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
						<TabButton
							id="voice"
							label={t('settings.voice_video')}
							icon={Mic}
							activeTab={activeTab}
							setActiveTab={setActiveTab}
						/>
					</div>
				</div>

				<div className="pt-4 mt-auto">
					<div className="h-[1px] bg-border mb-4 mx-2" />
					<button
						onClick={() => setShowLogoutConfirm(true)}
						className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-destructive hover:bg-destructive/10 transition-all text-sm font-medium"
					>
						<LogOut size={18} />
						{t('settings.logout')}
					</button>

					<ConfirmModal
						isOpen={showLogoutConfirm}
						onClose={() => setShowLogoutConfirm(false)}
						onConfirm={logout}
						title="Logout"
						message="Are you sure you want to log out? You will need to sign in again to access your messages."
						confirmText="Logout"
						variant="danger"
					/>
				</div>
			</div>
		</div>
	);
};
