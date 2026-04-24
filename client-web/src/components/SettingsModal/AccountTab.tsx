import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/store';
import { Avatar as MinidenticonAvatar } from '@/components/Avatar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiUploadFile, apiGetFileUrl } from '@/api/client';
import { ConfirmModal } from '../ConfirmModal';

export const AccountTab = () => {
	const { t } = useTranslation();
	const user = useAuthStore((state) => state.user);
	const updateUser = useAuthStore((state) => state.updateUser);
	const deleteAccount = useAuthStore((state) => state.deleteAccount);

	const [isUploading, setIsUploading] = useState(false);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [isEditingUsername, setIsEditingUsername] = useState(false);
	const [newUsername, setNewUsername] = useState(user?.username || '');
	const [usernameError, setUsernameError] = useState<string | null>(null);

	const [customMsg, setCustomMsg] = useState(user?.custom_msg || '');
	const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

	const [oldPassword, setOldPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
	const [passwordError, setPasswordError] = useState<string | null>(null);

	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		setIsUploading(true);
		try {
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
			setUsernameError(null);
			return;
		}
		setUsernameError(null);
		try {
			await updateUser({ username: newUsername });
			setIsEditingUsername(false);
		} catch (error: any) {
			console.error('Failed to update username:', error);
			if (error.message === 'username taken') {
				setUsernameError(t('auth.errors.username_taken'));
			} else {
				setUsernameError(error.message || 'Failed to update username');
			}
		}
	};

	const handleUpdateStatus = async () => {
		if (customMsg === user?.custom_msg) return;
		setIsUpdatingStatus(true);
		try {
			await updateUser({ custom_msg: customMsg });
		} catch (error) {
			console.error('Failed to update status:', error);
		} finally {
			setIsUpdatingStatus(false);
		}
	};

	const handleUpdatePassword = async () => {
		if (!newPassword || !oldPassword) {
			setPasswordError('Both current and new passwords are required');
			return;
		}
		if (newPassword.length < 8) {
			setPasswordError(t('auth.errors.password_length'));
			return;
		}
		setPasswordError(null);
		setIsUpdatingPassword(true);
		try {
			await updateUser({
				password: newPassword,
				old_password: oldPassword,
			});
			setNewPassword('');
			setOldPassword('');
		} catch (err: any) {
			console.error('Password update failed:', err);
			if (err.message === 'invalid current password') {
				setPasswordError('Incorrect current password');
			} else {
				setPasswordError(err.message || 'Failed to update password');
			}
		} finally {
			setIsUpdatingPassword(false);
		}
	};

	const handleDeleteAccount = async () => {
		try {
			await deleteAccount();
		} catch (error) {
			console.error('Failed to delete account:', error);
		}
	};

	if (!user) return null;

	return (
		<div className="w-full max-w-[500px] mx-auto animate-in fade-in slide-in-from-right-4 duration-300">
			<h2 className="text-xl font-bold text-foreground mb-5">
				{t('settings.my_account')}
			</h2>

			{/* Profile Header Card */}
			<div className="bg-secondary/50 rounded-lg overflow-hidden mb-6 shadow-lg border border-border/50">
				<div className="h-20 bg-primary" />
				<div className="px-4 pb-4 flex flex-col gap-4">
					<div className="flex items-center gap-4 -mt-10 mb-2">
						<div className="relative group">
							<Avatar className="w-20 h-20 border-[6px] border-background bg-background rounded-full overflow-hidden shadow-lg relative">
								{user?.avatar_id && (
									<AvatarImage
										src={apiGetFileUrl(user.avatar_id)}
										className="object-cover"
									/>
								)}
								<AvatarFallback className="bg-transparent">
									<MinidenticonAvatar userId={user?.id || ''} size={64} />
								</AvatarFallback>
								{isUploading && (
									<div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-full z-10">
										<Loader2 size={24} className="text-white animate-spin" />
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
									~{user?.domain}
								</span>
							</div>
						</div>
					</div>

					<div className="bg-background/50 p-3 rounded-md border border-border/50">
						<div className="flex items-center justify-between mb-4">
							<div className="flex-1 mr-4">
								<div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
									{t('settings.username')}
								</div>
								{isEditingUsername ? (
									<div className="space-y-2">
										<Input
											value={newUsername}
											onChange={(e) => {
												setNewUsername(e.target.value);
												setUsernameError(null);
											}}
											onKeyDown={(e) =>
												e.key === 'Enter' && handleUpdateUsername()
											}
											className={`h-8 bg-secondary border-none text-foreground focus-visible:ring-1 ${usernameError ? 'ring-1 ring-destructive' : 'focus-visible:ring-primary'}`}
											autoFocus
										/>
										{usernameError && (
											<p className="text-[10px] text-destructive font-bold animate-in fade-in slide-in-from-top-1">
												{usernameError}
											</p>
										)}
									</div>
								) : (
									<div className="text-sm text-foreground font-medium">
										{user?.username}
									</div>
								)}
							</div>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => {
									if (isEditingUsername) {
										handleUpdateUsername();
									} else {
										setIsEditingUsername(true);
									}
								}}
								className="bg-accent hover:bg-accent/80 text-accent-foreground h-8 px-4 text-xs font-semibold rounded-[3px]"
							>
								{isEditingUsername ? t('common.save') : t('settings.edit')}
							</Button>
						</div>

						{/* Online Status */}
						<div className="pt-4 border-t border-border/30 mb-4">
							<div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
								Online Status
							</div>
							<div className="flex gap-2">
								{[
									{ id: 'auto', color: 'bg-blue-500', label: 'Auto' },
									{ id: 'online', color: 'bg-green-500', label: 'Online' },
									{ id: 'away', color: 'bg-yellow-500', label: 'Idle' },
									{ id: 'dnd', color: 'bg-red-500', label: 'Do Not Disturb' },
									{ id: 'offline', color: 'bg-gray-500', label: 'Invisible' },
								].map((s) => {
									const isSelected = (user?.status_preference || 'auto') === s.id;
									return (
										<button
											key={s.id}
											disabled={isUpdatingStatus}
											onClick={async () => {
												setIsUpdatingStatus(true);
												try {
													await updateUser({ status_preference: s.id });
												} finally {
													setIsUpdatingStatus(false);
												}
											}}
											className={`group relative flex items-center justify-center w-8 h-8 rounded-md transition-all ${
												isSelected
													? 'bg-primary/20 ring-1 ring-primary'
													: 'bg-secondary/40 hover:bg-secondary/60'
											} ${isUpdatingStatus ? 'opacity-50 cursor-not-allowed' : ''}`}
											title={s.label}
										>
											{s.id === 'auto' ? (
												<span className="text-[10px] font-bold text-blue-500">A</span>
											) : (
												<div className={`w-3 h-3 rounded-full ${s.color}`} />
											)}
											<div className="absolute bottom-full mb-2 px-2 py-1 bg-popover text-popover-foreground text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-xl border border-border">
												{s.label}
											</div>
										</button>
									);
								})}
							</div>
						</div>

						{/* Custom Status / Bio */}
						<div className="pt-4 border-t border-border/30">
							<div className="flex items-center justify-between mb-2">
								<div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
									{t('settings.about_me')}
								</div>
								{customMsg !== (user?.custom_msg || '') && (
									<Button
										variant="ghost"
										size="sm"
										onClick={handleUpdateStatus}
										disabled={isUpdatingStatus}
										className="h-6 px-2 text-[10px] font-bold bg-primary/20 hover:bg-primary/30 text-primary-foreground"
									>
										{isUpdatingStatus ? (
											<Loader2 size={12} className="animate-spin" />
										) : (
											t('common.save')
										)}
									</Button>
								)}
							</div>
							<div className="relative">
								<textarea
									value={customMsg}
									onChange={(e) => setCustomMsg(e.target.value)}
									placeholder="Tell us about yourself..."
									className="w-full bg-secondary/50 border-none rounded p-2 text-sm text-foreground focus:ring-1 focus:ring-primary min-h-[60px] resize-none"
								/>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Password Change Section */}
			<div className="bg-secondary/30 rounded-lg p-4 mb-6 border border-border/50">
				<h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-4">
					{t('settings.password_change')}
				</h3>
				<div className="space-y-4">
					<div className="grid gap-4">
						<div className="grid gap-1.5">
							<label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
								Current Password
							</label>
							<Input
								type="password"
								value={oldPassword}
								onChange={(e) => {
									setOldPassword(e.target.value);
									setPasswordError(null);
								}}
								placeholder="Enter current password"
								className="bg-background border-none text-foreground h-9 text-sm"
							/>
						</div>
						<div className="grid gap-1.5">
							<label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
								{t('settings.new_password')}
							</label>
							<div className="flex gap-2">
								<Input
									type="password"
									value={newPassword}
									onChange={(e) => {
										setNewPassword(e.target.value);
										setPasswordError(null);
									}}
									placeholder="Enter new password"
									className="bg-background border-none text-foreground h-9 text-sm"
								/>
								<Button
									onClick={handleUpdatePassword}
									disabled={isUpdatingPassword || !newPassword || !oldPassword}
									className="h-9 px-4 text-xs font-bold"
								>
									{isUpdatingPassword ? (
										<Loader2 size={16} className="animate-spin" />
									) : (
										t('settings.update_password')
									)}
								</Button>
							</div>
						</div>
						{passwordError && (
							<p className="text-[10px] text-destructive font-bold animate-in fade-in slide-in-from-top-1">
								{passwordError}
							</p>
						)}
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
				
				<Button
					variant="destructive"
					className="font-bold h-9 px-6 transition-all"
					onClick={() => setShowDeleteConfirm(true)}
				>
					{t('settings.delete_account')}
				</Button>

				<ConfirmModal
					isOpen={showDeleteConfirm}
					onClose={() => setShowDeleteConfirm(false)}
					onConfirm={handleDeleteAccount}
					title="Delete Account"
					message="Are you absolutely sure you want to delete your account? This will permanently remove your profile, channels you own, and all your messages. This action is irreversible."
					confirmText="Delete Account"
					variant="danger"
				/>
			</div>
		</div>
	);
};
