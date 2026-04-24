import React from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle } from 'lucide-react';

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
	if (!isOpen) return null;

	return createPortal(
		<div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-200">
			<div 
				className="bg-card w-full max-w-md rounded-xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-200"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className="flex items-center justify-between px-6 py-4 border-b border-border bg-accent/30">
					<div className="flex items-center gap-2">
						{variant === 'danger' && <AlertTriangle className="text-destructive" size={20} />}
						<h3 className="text-lg font-bold text-foreground">{title}</h3>
					</div>
					<button 
						onClick={onClose}
						className="p-1 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-colors"
					>
						<X size={20} />
					</button>
				</div>

				{/* Content */}
				<div className="px-6 py-8">
					<p className="text-[15px] text-muted-foreground leading-relaxed">
						{message}
					</p>
				</div>

				{/* Footer */}
				<div className="px-6 py-4 bg-accent/30 flex justify-end gap-3">
					<button
						onClick={onClose}
						className="px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-accent rounded-lg transition-colors"
					>
						{cancelText}
					</button>
					<button
						onClick={() => {
							onConfirm();
							onClose();
						}}
						className={`px-5 py-2.5 text-sm font-semibold text-white rounded-lg transition-all shadow-sm ${
							variant === 'danger' 
								? 'bg-destructive hover:bg-destructive/90 active:scale-95' 
								: 'bg-primary hover:bg-primary/90 active:scale-95'
						}`}
					>
						{confirmText}
					</button>
				</div>
			</div>
		</div>,
		document.body
	);
};
