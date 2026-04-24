import { useTranslation } from 'react-i18next';
import { ShieldAlert } from 'lucide-react';

export const PrivacyTab = () => {
	const { t } = useTranslation();

	return (
		<div className="w-full h-full flex flex-col items-center justify-center text-center p-6 animate-in fade-in zoom-in-95 duration-500">
			<div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
				<ShieldAlert size={40} className="text-primary" />
			</div>
			<h2 className="text-2xl font-bold text-foreground mb-3">
				{t('settings.privacy')}
			</h2>
			<p className="text-muted-foreground max-w-[320px] leading-relaxed">
				We are working hard to bring you advanced privacy controls and safety features. 
				Check back soon for encrypted message scanning and DM permissions!
			</p>
			
			<div className="mt-8 px-4 py-2 bg-secondary rounded-full text-[10px] font-bold uppercase tracking-widest text-primary border border-primary/20">
				Coming Soon
			</div>
		</div>
	);
};
