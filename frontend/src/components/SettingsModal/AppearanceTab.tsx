import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { useAppStore } from '@/store/store';

export const AppearanceTab = () => {
	const { t, i18n } = useTranslation();
	const theme = useAppStore((state) => state.theme);
	const setTheme = useAppStore((state) => state.setTheme);

	const changeLanguage = (lng: string) => {
		i18n.changeLanguage(lng);
	};

	return (
		<div className="max-w-[500px] animate-in fade-in slide-in-from-right-4 duration-300">
			<h2 className="text-xl font-bold text-foreground mb-5">
				{t('settings.appearance')}
			</h2>

			<div className="space-y-8">
				{/* Theme Section */}
				<section>
					<h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
						{t('settings.theme')}
					</h3>
					<div className="grid grid-cols-2 gap-3">
						<button
							onClick={() => setTheme('dark')}
							className={`flex flex-col gap-2 p-3 rounded-lg border-2 transition-all ${
								theme === 'dark'
									? 'border-primary bg-secondary'
									: 'border-transparent bg-secondary hover:bg-secondary/80'
							}`}
						>
							<div className="h-12 w-full bg-[#1e1f22] rounded flex items-center justify-center overflow-hidden relative">
								<div className="absolute top-2 left-2 w-4 h-4 bg-[#2b2d31] rounded-full" />
								<div className="flex flex-col gap-1 w-full px-8">
									<div className="h-1.5 w-full bg-[#3f4147] rounded-full" />
									<div className="h-1.5 w-2/3 bg-[#3f4147] rounded-full" />
								</div>
								{theme === 'dark' && (
									<div className="absolute bottom-2 right-2 bg-primary rounded-full p-0.5">
										<Check size={12} className="text-white" />
									</div>
								)}
							</div>
							<span
								className={`text-sm font-bold text-center ${theme === 'dark' ? 'text-foreground' : 'text-muted-foreground'}`}
							>
								{t('settings.dark')}
							</span>
						</button>
						<button
							onClick={() => setTheme('light')}
							className={`flex flex-col gap-2 p-3 rounded-lg border-2 transition-all ${
								theme === 'light'
									? 'border-primary bg-white shadow-md'
									: 'border-transparent bg-[#f2f3f5] hover:bg-[#ebedef]'
							}`}
						>
							<div className="h-12 w-full bg-[#f2f3f5] rounded flex items-center justify-center overflow-hidden relative">
								<div className="absolute top-2 left-2 w-4 h-4 bg-white rounded-full border border-[#e3e5e8]" />
								<div className="flex flex-col gap-1 w-full px-8">
									<div className="h-1.5 w-full bg-[#e3e5e8] rounded-full" />
									<div className="h-1.5 w-2/3 bg-[#e3e5e8] rounded-full" />
								</div>
								{theme === 'light' && (
									<div className="absolute bottom-2 right-2 bg-primary rounded-full p-0.5">
										<Check size={12} className="text-white" />
									</div>
								)}
							</div>
							<span
								className={`text-sm font-bold text-center ${theme === 'light' ? 'text-black' : 'text-muted-foreground'}`}
							>
								{t('settings.light')}
							</span>
						</button>
					</div>
				</section>

				{/* Language Section */}
				<section>
					<h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
						{t('settings.language')}
					</h3>
					<div className="space-y-1 bg-secondary/50 rounded-md overflow-hidden p-1 shadow-inner border border-border/50">
						{[
							{ id: 'en', name: 'English', local: 'English' },
							{ id: 'fa', name: 'Persian', local: 'فارسی' },
							{ id: 'ar', name: 'Arabic', local: 'العربية' },
						].map((lang) => (
							<button
								key={lang.id}
								onClick={() => changeLanguage(lang.id)}
								className={`w-full flex items-center justify-between px-3 py-2 rounded transition-colors text-sm font-medium ${
									i18n.language.startsWith(lang.id)
										? 'bg-accent text-accent-foreground'
										: 'text-foreground hover:bg-accent/50'
								}`}
							>
								<div className="flex flex-col items-start leading-tight">
									<span>{lang.name}</span>
									<span className="text-[11px] opacity-60">
										{lang.local}
									</span>
								</div>
								{i18n.language.startsWith(lang.id) && (
									<Check size={16} className="text-primary" />
								)}
							</button>
						))}
					</div>
				</section>
			</div>
		</div>
	);
};
