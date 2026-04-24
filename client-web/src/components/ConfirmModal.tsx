import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { 
	Dialog, 
	DialogPortal, 
	DialogOverlay,
} from '@/components/ui/dialog';

interface ConfirmModalProps {
	isOpen: boolean;
	onClose: () => void;
	onConfirm: () => void;
	title: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
	variant?: 'danger' | 'primary';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
	isOpen,
	onClose,
	onConfirm,
	title,
	message,
	confirmText = 'Confirm',
	cancelText = 'Cancel',
	variant = 'primary',
}) => {
	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogPortal>
				<DialogOverlay className="z-[1000] backdrop-blur-[2px]" />
				<DialogPrimitive.Content 
					className="fixed left-[50%] top-[50%] z-[1001] w-full max-w-md translate-x-[-50%] translate-y-[-50%] outline-none animate-in zoom-in-95 duration-200"
				>
					<div 
						className="bg-card w-full rounded-xl shadow-2xl border border-border overflow-hidden"
						onClick={(e) => e.stopPropagation()}
					>
						{/* Header */}
						<div className="flex items-center justify-between px-6 py-4 border-b border-border bg-accent/30">
							<div className="flex items-center gap-2">
								{variant === 'danger' && <AlertTriangle className="text-destructive" size={20} />}
								<DialogPrimitive.Title className="text-lg font-bold text-foreground">
									{title}
								</DialogPrimitive.Title>
							</div>
							<DialogPrimitive.Close className="p-1 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-colors outline-none">
								<X size={20} />
							</DialogPrimitive.Close>
						</div>

						{/* Content */}
						<div className="px-6 py-8">
							<DialogPrimitive.Description className="text-[15px] text-muted-foreground leading-relaxed">
								{message}
							</DialogPrimitive.Description>
						</div>

						{/* Footer */}
						<div className="px-6 py-4 bg-accent/30 flex justify-end gap-3">
							<button
								onClick={onClose}
								className="px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-accent rounded-lg transition-colors outline-none"
							>
								{cancelText}
							</button>
							<button
								onClick={() => {
									onConfirm();
									onClose();
								}}
								className={`px-5 py-2.5 text-sm font-semibold text-white rounded-lg transition-all shadow-sm outline-none ${
									variant === 'danger' 
										? 'bg-destructive hover:bg-destructive/90 active:scale-95' 
										: 'bg-primary hover:bg-primary/90 active:scale-95'
								}`}
							>
								{confirmText}
							</button>
						</div>
					</div>
				</DialogPrimitive.Content>
			</DialogPortal>
		</Dialog>
	);
};
