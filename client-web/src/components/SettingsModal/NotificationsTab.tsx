import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/store/store';
import { requestNotificationPermission } from '@/utils/notifications';

export const NotificationsTab = () => {
	const { t } = useTranslation();
	const {
		enableDesktopNotifications,
		enableNotificationSounds,
		setEnableDesktopNotifications,
		setEnableNotificationSounds,
	} = useAppStore();

	const handleToggleDesktop = async () => {
		const newVal = !enableDesktopNotifications;
		if (newVal) {
			const permission = await requestNotificationPermission();
			if (permission !== 'granted') {
				// Optionally show an error toast here if we had one
				console.warn('Notification permission denied');
				return;
			}
		}
		setEnableDesktopNotifications(newVal);
	};

	return (
		<div className="w-full max-w-[500px] mx-auto animate-in fade-in slide-in-from-right-4 duration-300">
			<h2 className="text-xl font-bold text-foreground mb-5">
				{t('settings.notifications')}
			</h2>
			<div className="space-y-6">
				<div className="bg-secondary/30 rounded-lg p-4 border border-border/50">
					<div className="flex items-center justify-between mb-4">
						<div className="flex-1 mr-4">
							<div className="text-sm font-bold text-foreground">
								Enable Desktop Notifications
							</div>
							<div className="text-[11px] text-muted-foreground mt-0.5">
								Receive browser alerts when you have new messages while the tab is inactive.
							</div>
						</div>
						<button
							onClick={handleToggleDesktop}
							className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${enableDesktopNotifications ? 'bg-green-500' : 'bg-muted-foreground/30'}`}
						>
							<div
								className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${enableDesktopNotifications ? 'translate-x-4' : ''}`}
							/>
						</button>
					</div>
					<div className="flex items-center justify-between">
						<div className="flex-1 mr-4">
							<div className="text-sm font-bold text-foreground">
								Enable Notification Sounds
							</div>
							<div className="text-[11px] text-muted-foreground mt-0.5">
								Play a subtle sound for every incoming message.
							</div>
						</div>
						<button
							onClick={() => setEnableNotificationSounds(!enableNotificationSounds)}
							className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${enableNotificationSounds ? 'bg-green-500' : 'bg-muted-foreground/30'}`}
						>
							<div
								className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${enableNotificationSounds ? 'translate-x-4' : ''}`}
							/>
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};
