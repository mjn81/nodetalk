import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const PrivacyTab = () => {
	const { t } = useTranslation();
	const [privacySettings, setPrivacySettings] = useState({
		allowDMs: true,
		safeMessaging: true,
		dataPersonalization: false,
	});

	return (
		<div className="max-w-[500px] animate-in fade-in slide-in-from-right-4 duration-300">
			<h2 className="text-xl font-bold text-foreground mb-5">
				{t('settings.privacy')}
			</h2>
			<div className="space-y-6">
				<div className="bg-secondary/30 rounded-lg p-4 border border-border/50">
					<div className="flex items-center justify-between mb-2">
						<div>
							<div className="text-sm font-bold text-foreground">
								Allow direct messages from server members
							</div>
							<div className="text-xs text-muted-foreground">
								This setting is applied when you join a new server.
							</div>
						</div>
						<button
							onClick={() =>
								setPrivacySettings((s) => ({
									...s,
									allowDMs: !s.allowDMs,
								}))
							}
							className={`w-10 h-6 rounded-full transition-colors relative ${privacySettings.allowDMs ? 'bg-green-500' : 'bg-muted-foreground/30'}`}
						>
							<div
								className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${privacySettings.allowDMs ? 'translate-x-4' : ''}`}
							/>
						</button>
					</div>
				</div>
				<div className="bg-secondary/30 rounded-lg p-4 border border-border/50">
					<div className="flex items-center justify-between mb-2">
						<div>
							<div className="text-sm font-bold text-foreground">
								Safe Direct Messaging
							</div>
							<div className="text-xs text-muted-foreground">
								Automatically scan and delete direct messages you receive
								that contain explicit media content.
							</div>
						</div>
						<button
							onClick={() =>
								setPrivacySettings((s) => ({
									...s,
									safeMessaging: !s.safeMessaging,
								}))
							}
							className={`w-10 h-6 rounded-full transition-colors relative ${privacySettings.safeMessaging ? 'bg-green-500' : 'bg-muted-foreground/30'}`}
						>
							<div
								className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${privacySettings.safeMessaging ? 'translate-x-4' : ''}`}
							/>
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};
