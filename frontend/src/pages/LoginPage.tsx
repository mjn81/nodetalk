import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
import { useAuthStore } from '@/store/store';

export default function LoginPage() {
	const { t } = useTranslation();
	const login = useAuthStore((state) => state.login);
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');
		if (!username || !password) {
			setError(t('auth.errors.required'));
			return;
		}
		setLoading(true);
		try {
			await login(username, password);
		} catch (err: unknown) {
			setError((err as Error).message ?? t('auth.errors.login_failed'));
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="flex h-screen w-full items-center justify-center bg-[#313338]">
			<Card className="w-full max-w-[480px] bg-[#313338] border-none sm:bg-[#2b2d31] sm:shadow-lg sm:p-4 text-[#dbdee1]">
				<CardHeader className="text-center space-y-2 pb-6">
					<CardTitle className="text-2xl font-bold text-white tracking-wide">
						Welcome back!
					</CardTitle>
					<CardDescription className="text-[#b5bac1] text-base">
						We're so excited to see you again!
					</CardDescription>
				</CardHeader>
				<CardContent>
					{error && (
						<div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md mb-4 border border-destructive/20 text-center">
							{error}
						</div>
					)}
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="space-y-2">
							<Label
								htmlFor="login-username"
								className="text-xs uppercase font-bold text-[#b5bac1]"
							>
								{t('auth.username')}
								<span className="text-destructive ml-1">*</span>
							</Label>
							<Input
								id="login-username"
								className="bg-[#1e1f22] border-none text-[15px] h-10 text-[#dbdee1] focus-visible:ring-0 focus-visible:ring-offset-0"
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
								htmlFor="login-password"
								className="text-xs uppercase font-bold text-[#b5bac1]"
							>
								{t('auth.password')}
								<span className="text-destructive ml-1">*</span>
							</Label>
							<Input
								id="login-password"
								type="password"
								className="bg-[#1e1f22] border-none text-[15px] h-10 text-[#dbdee1] focus-visible:ring-0 focus-visible:ring-offset-0"
								value={password}
								onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
									setPassword(e.target.value)
								}
								autoComplete="current-password"
								required
							/>
						</div>
						<Button
							type="submit"
							className="w-full h-11 bg-primary hover:bg-[#4752C4] text-white font-medium text-base mt-2 transition-colors"
							disabled={loading}
						>
							{loading ? <span className="spinner" /> : 'Log In'}
						</Button>
					</form>
				</CardContent>
				<CardFooter className="flex flex-col items-start gap-2 pt-2">
					<div className="text-sm text-[#949ba4]">
						Need an account?{' '}
						<Link
							to="/register"
							className="text-primary hover:underline font-medium"
						>
							Register
						</Link>
					</div>
				</CardFooter>
			</Card>
		</div>
	);
}
