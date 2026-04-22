import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
	User,
	Settings as SettingsIcon,
	Palette,
	Camera,
	LogOut,
	Shield,
	Bell,
	Check,
	Loader2,
	X,
} from 'lucide-react';
import { useAuthStore, useAppStore } from '@/store/store';
import { Avatar as MinidenticonAvatar } from '@/components/Avatar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { apiUploadFile, apiGetFileUrl } from '@/api/client';
import { Input } from './ui/input';

interface SettingsModalProps {
	onClose: () => void;
}

type SettingsTab = 'account' | 'appearance' | 'privacy' | 'notifications';

interface TabButtonProps {
	id: SettingsTab;
	label: string;
	icon: any;
	activeTab: SettingsTab;
	setActiveTab: (id: SettingsTab) => void;
}

const TabButton = ({
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
			className={activeTab === id ? 'text-accent-foreground' : 'text-muted-foreground'}
		/>
		{label}
	</button>
);

export default function SettingsModal({ onClose }: SettingsModalProps) {
	const { t, i18n } = useTranslation();
	const user = useAuthStore((state) => state.user);
	const updateUser = useAuthStore((state) => state.updateUser);
	const deleteAccount = useAuthStore((state) => state.deleteAccount);
	const logout = useAuthStore((state) => state.logout);

	const theme = useAppStore((state) => state.theme);
	const setTheme = useAppStore((state) => state.setTheme);

	const [activeTab, setActiveTab] = useState<SettingsTab>('account');
	const [isUploading, setIsUploading] = useState(false);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [isEditingUsername, setIsEditingUsername] = useState(false);
	const [newUsername, setNewUsername] = useState(user?.username || '');

	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		setIsUploading(true);
		try {
			// Upload as raw file (unencrypted for public avatar)
			const res = await apiUploadFile(file, file.type);
			const fileId = (res as any).id;
			await updateUser({ avatar_id: fileId });
		} catch (error) {
			console.error('Failed to upload avatar:', error);
		} finally {
			setIsUploading(false);
		}
	};

	const handleUpdateUsername = async () => {
		if (!newUsername.trim() || newUsername === user?.username) {
			setIsEditingUsername(false);
			return;
		}
		try {
			// Note: Assuming updateUser can also handle username if backend supports it.
			// If not, I'll just keep it as is or add support.
			// For now, let's assume we can update it.
			await updateUser({ username: newUsername });
			setIsEditingUsername(false);
		} catch (error) {
			console.error('Failed to update username:', error);
		}
	};

	const handleDeleteAccount = async () => {
		try {
			await deleteAccount();
			onClose();
		} catch (error) {
			console.error('Failed to delete account:', error);
		}
	};

	const changeLanguage = (lng: string) => {
		i18n.changeLanguage(lng);
	};

	if (!user) return null;

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="bg-background border-none text-foreground max-w-[800px] h-[600px] flex flex-col p-0 overflow-hidden shadow-2xl rounded-lg [&>button]:hidden">
				<DialogTitle className="sr-only">{t('settings.title')}</DialogTitle>
				<DialogDescription className="sr-only">
					{t('settings.delete_description')}
				</DialogDescription>
				<div className="flex h-full">
					{/* Settings Sidebar - Discord Style */}
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

					{/* Settings Content */}
					<div className="flex-1 flex flex-col bg-background relative">
						<div className="flex-1 overflow-y-auto custom-scrollbar p-10 pt-12 pb-20">
							{activeTab === 'account' && (
								<div className="max-w-[500px] animate-in fade-in slide-in-from-right-4 duration-300">
									<h2 className="text-xl font-bold text-foreground mb-5">
										{t('settings.my_account')}
									</h2>

									{/* Profile Header Card */}
									<div className="bg-secondary/50 rounded-lg overflow-hidden mb-6 shadow-lg border border-border/50">
										<div className="h-20 bg-primary" />
										<div className="px-4 pb-4 flex flex-col gap-4">
											<div className="flex items-end gap-4 -mt-10 mb-2">
												<div className="relative group">
													<Avatar className="w-20 h-20 border-[6px] border-background bg-background rounded-full overflow-hidden shadow-lg relative">
														{user?.avatar_id && (
															<AvatarImage
																src={apiGetFileUrl(user.avatar_id)}
																className="object-cover"
															/>
														)}
														<AvatarFallback className="bg-transparent">
															<MinidenticonAvatar
																userId={user?.user_id || ''}
																size={64}
															/>
														</AvatarFallback>
														{isUploading && (
															<div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-full z-10">
																<Loader2
																	size={24}
																	className="text-white animate-spin"
																/>
															</div>
														)}
													</Avatar>
													<button
														onClick={() => fileInputRef.current?.click()}
														className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full z-20"
													>
														<Camera size={20} className="text-white" />
													</button>
													<input
														type="file"
														ref={fileInputRef}
														className="hidden"
														accept="image/*"
														onChange={handleAvatarUpload}
													/>
												</div>
												<div className="mb-2">
													<div className="text-lg font-bold text-foreground flex items-center gap-1.5 leading-tight">
														{user?.username}
														<span className="text-muted-foreground font-medium">
															#{user?.user_id?.slice(0, 4)}
														</span>
													</div>
													<div className="text-xs text-muted-foreground font-medium">
														{user?.domain}
													</div>
												</div>
											</div>

											<div className="bg-background/50 p-3 rounded-md border border-border/50">
												<div className="flex items-center justify-between">
													<div className="flex-1 mr-4">
														<div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
															{t('settings.username')}
														</div>
														{isEditingUsername ? (
															<Input
																value={newUsername}
																onChange={(e) => setNewUsername(e.target.value)}
																onBlur={handleUpdateUsername}
																onKeyDown={(e) =>
																	e.key === 'Enter' && handleUpdateUsername()
																}
																className="h-8 bg-secondary border-none text-foreground focus-visible:ring-1 focus-visible:ring-primary"
																autoFocus
															/>
														) : (
															<div className="text-sm text-foreground font-medium">
																{user?.username}
															</div>
														)}
													</div>
													<Button
														variant="ghost"
														size="sm"
														onClick={() => setIsEditingUsername(true)}
														className="bg-accent hover:bg-accent/80 text-accent-foreground h-8 px-4 text-xs font-semibold rounded-[3px]"
													>
														{isEditingUsername
															? t('common.save')
															: t('settings.edit')}
													</Button>
												</div>
											</div>
										</div>
									</div>

									{/* Account Removal Section */}
									<div className="pt-6 border-t border-border">
										<h3 className="text-[11px] font-bold text-destructive uppercase tracking-wider mb-3">
											{t('settings.account_removal')}
										</h3>
										<p className="text-xs text-muted-foreground mb-4 leading-relaxed">
											{t('settings.delete_description')}
										</p>
										{showDeleteConfirm ? (
											<div className="p-4 bg-destructive/10 rounded-md border border-destructive/20 animate-in fade-in zoom-in-95 duration-200">
												<p className="text-sm font-bold text-destructive mb-3">
													Are you absolutely sure?
												</p>
												<div className="flex gap-3">
													<Button
														variant="destructive"
														className="font-bold h-9 px-6"
														onClick={handleDeleteAccount}
													>
														{t('settings.delete_confirm')}
													</Button>
													<Button
														variant="ghost"
														className="text-foreground hover:bg-accent h-9 px-6 font-medium"
														onClick={() => setShowDeleteConfirm(false)}
													>
														{t('settings.cancel')}
													</Button>
												</div>
											</div>
										) : (
											<Button
												variant="destructive"
												className="font-bold h-9 px-6 transition-all"
												onClick={() => setShowDeleteConfirm(true)}
											>
												{t('settings.delete_account')}
											</Button>
										)}
									</div>
								</div>
							)}

							{activeTab === 'appearance' && (
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
							)}

							{(activeTab === 'privacy' || activeTab === 'notifications') && (
								<div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
									<SettingsIcon size={48} className="opacity-20" />
									<div className="text-center">
										<h3 className="text-lg font-bold text-foreground">
											{t('settings.wip_title')}
										</h3>
										<p className="text-sm">{t('settings.wip_description')}</p>
									</div>
								</div>
							)}
						</div>

						{/* Floating Close Button - Discord Style */}
						<div className="absolute top-12 right-12">
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
