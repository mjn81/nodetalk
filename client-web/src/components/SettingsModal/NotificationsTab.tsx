import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const NotificationsTab = () => {
	const { t } = useTranslation();
	const [notificationSettings, setNotificationSettings] = useState({
		enableDesktop: true,
		enableSound: true,
		unreadBadge: true,
		pushMentions: true,
	});

	return (
		<div className="max-w-[500px] animate-in fade-in slide-in-from-right-4 duration-300">
			<h2 className="text-xl font-bold text-foreground mb-5">
				{t('settings.notifications')}
			</h2>
			<div className="space-y-6">
				<div className="bg-secondary/30 rounded-lg p-4 border border-border/50">
					<div className="flex items-center justify-between mb-4">
						<div>
							<div className="text-sm font-bold text-foreground">
								Enable Desktop Notifications
							</div>
						</div>
						<button
							onClick={() =>
								setNotificationSettings((s) => ({
									...s,
									enableDesktop: !s.enableDesktop,
								}))
							}
							className={`w-10 h-6 rounded-full transition-colors relative ${notificationSettings.enableDesktop ? 'bg-green-500' : 'bg-muted-foreground/30'}`}
						>
							<div
								className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${notificationSettings.enableDesktop ? 'translate-x-4' : ''}`}
							/>
						</button>
					</div>
					<div className="flex items-center justify-between">
						<div>
							<div className="text-sm font-bold text-foreground">
								Enable Notification Sounds
							</div>
						</div>
						<button
							onClick={() =>
								setNotificationSettings((s) => ({
									...s,
									enableSound: !s.enableSound,
								}))
							}
							className={`w-10 h-6 rounded-full transition-colors relative ${notificationSettings.enableSound ? 'bg-green-500' : 'bg-muted-foreground/30'}`}
						>
							<div
								className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${notificationSettings.enableSound ? 'translate-x-4' : ''}`}
							/>
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};
