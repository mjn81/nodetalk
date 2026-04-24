import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiRegister, BASE_URL } from '@/api/client';
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { isWails } from '@/utils/wails';

export default function RegisterPage() {
	const { t } = useTranslation();
	const navigate = useNavigate();

	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');

		if (!username || !password) {
			setError(t('auth.errors.required'));
			return;
		}
		if (username.length < 3) {
			setError(t('auth.errors.username_length') || 'Username must be at least 3 characters');
			return;
		}
		if (password.length < 8) {
			setError(t('auth.errors.password_length'));
			return;
		}

		setLoading(true);
		try {
			await apiRegister(username, password);
			setSuccess(true);
			setTimeout(() => navigate('/login'), 2000);
		} catch (err: unknown) {
			setError(t((err as Error).message) || t('auth.errors.register_failed'));
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="flex h-screen w-full flex-col items-center justify-center bg-background relative overflow-hidden">
			<Card className="w-full max-w-[480px] bg-background border-none sm:bg-secondary/50 sm:backdrop-blur-md sm:shadow-lg sm:p-4 text-foreground z-10">
				<CardHeader className="text-center space-y-2 pb-6">
					<CardTitle className="text-2xl font-bold text-foreground tracking-wide">
						Create an account
					</CardTitle>
					<CardDescription className="text-muted-foreground text-base">
						Join NodeTalk and start chatting.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{error && (
						<div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md mb-4 border border-destructive/20 text-center">
							{error}
						</div>
					)}
					{success && (
						<div className="bg-green-500/10 text-green-400 text-sm p-3 rounded-md mb-4 border border-green-500/20 text-center">
							Registration successful! Redirecting to login...
						</div>
					)}

					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="space-y-2">
							<Label
								htmlFor="reg-username"
								className="text-xs uppercase font-bold text-muted-foreground"
							>
								{t('auth.username')}
								<span className="text-destructive ml-1">*</span>
							</Label>
							<Input
								id="reg-username"
								className="bg-popover border-none text-[15px] h-10 text-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
								value={username}
								onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
									setUsername(e.target.value)
								}
								autoComplete="username"
								autoFocus
								required
							/>
						</div>
						<div className="space-y-2">
							<Label
								htmlFor="reg-password"
								className="text-xs uppercase font-bold text-muted-foreground"
							>
								{t('auth.password')}
								<span className="text-destructive ml-1">*</span>
							</Label>
							<Input
								id="reg-password"
								type="password"
								className="bg-popover border-none text-[15px] h-10 text-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
								value={password}
								onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
									setPassword(e.target.value)
								}
								autoComplete="new-password"
								required
							/>
						</div>
						<Button
							type="submit"
							className="w-full h-11 bg-primary hover:opacity-90 text-primary-foreground font-medium text-base mt-2 transition-colors"
							disabled={loading || success}
						>
							{loading ? <span className="spinner" /> : 'Continue'}
						</Button>
					</form>

					<div className="text-sm text-muted-foreground mt-4 text-center">
						<Link
							to="/login"
							className="text-primary hover:underline font-medium"
						>
							Already have an account?
						</Link>
					</div>
				</CardContent>

				{isWails() && (
					<CardFooter className="flex flex-col items-start gap-2 pt-2">
						<div className="mt-4 pt-4 border-t border-border/10 w-full flex items-center justify-between text-[11px] text-muted-foreground/60 italic">
							<span>Connecting to: {BASE_URL}</span>
							<Link
								to="/connect"
								className="text-primary hover:underline not-italic font-medium"
							>
								Change
							</Link>
						</div>
					</CardFooter>
				)}
			</Card>

			<div className="absolute bottom-8 flex flex-col items-center gap-1 opacity-40 hover:opacity-100 transition-opacity duration-300">
				<p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground select-none">
					NodeTalk is open source
				</p>
				<p className="text-[10px] font-medium text-muted-foreground select-none">
					made with ❤️ by <span className="text-foreground">mjn</span>
				</p>
			</div>
		</div>
	);
}
