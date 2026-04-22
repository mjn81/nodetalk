import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	Dialog,
	DialogContent,
	DialogTitle,
	DialogDescription,
} from '@/components/ui/dialog';
import { X } from 'lucide-react';
import { useAuthStore } from '@/store/store';
import { Sidebar } from './SettingsModal/Sidebar';
import { AccountTab } from './SettingsModal/AccountTab';
import { AppearanceTab } from './SettingsModal/AppearanceTab';
import { PrivacyTab } from './SettingsModal/PrivacyTab';
import { NotificationsTab } from './SettingsModal/NotificationsTab';
import type { SettingsTab } from './SettingsModal/types';

interface SettingsModalProps {
	onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
	const { t } = useTranslation();
	const user = useAuthStore((state) => state.user);
	const [activeTab, setActiveTab] = useState<SettingsTab>('account');

	if (!user) return null;

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="bg-background border-none text-foreground max-w-[800px] h-[600px] flex flex-col p-0 overflow-hidden shadow-2xl rounded-lg [&>button]:hidden">
				<DialogTitle className="sr-only">{t('settings.title')}</DialogTitle>
				<DialogDescription className="sr-only">
					{t('settings.delete_description')}
				</DialogDescription>
				<div className="flex h-full">
					<Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

					<div className="flex-1 flex flex-col bg-background relative">
						<div className="flex-1 overflow-y-auto custom-scrollbar p-10 pt-12 pb-20">
							{activeTab === 'account' && <AccountTab />}
							{activeTab === 'appearance' && <AppearanceTab />}
							{activeTab === 'privacy' && <PrivacyTab />}
							{activeTab === 'notifications' && <NotificationsTab />}
						</div>

						{/* Floating Close Button - Discord Style */}
						<div className="absolute top-6 right-6">
							<button
								onClick={onClose}
								className="group flex flex-col items-center gap-1"
							>
								<div className="w-9 h-9 rounded-full border-2 border-muted-foreground group-hover:border-foreground flex items-center justify-center transition-all">
									<X
										className="text-muted-foreground group-hover:text-foreground"
										size={20}
									/>
								</div>
								<span className="text-xs font-bold text-muted-foreground group-hover:text-foreground uppercase tracking-tighter">
									Esc
								</span>
							</button>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
