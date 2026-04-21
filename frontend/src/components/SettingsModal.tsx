import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';

interface SettingsModalProps {
	onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="bg-[#313338] border-none text-[#dbdee1] sm:max-w-[600px] h-[600px] flex flex-col p-0 overflow-hidden shadow-2xl">
				<div className="flex h-full">
					{/* Settings Sidebar */}
					<div className="w-[180px] bg-[#2b2d31] p-4 flex flex-col gap-1">
						<div className="text-xs font-bold text-[#949ba4] uppercase px-2 mb-1">
							User Settings
						</div>
						<button className="text-left px-2 py-1.5 rounded-md bg-[#3f4147] text-white text-sm font-medium">
							My Account
						</button>
						<button className="text-left px-2 py-1.5 rounded-md text-[#b5bac1] hover:bg-[#35373c] hover:text-[#dbdee1] text-sm font-medium">
							Privacy & Safety
						</button>
						<div className="h-[1px] bg-[#1e1f22] my-2 mx-2" />
						<div className="text-xs font-bold text-[#949ba4] uppercase px-2 mb-1">
							App Settings
						</div>
						<button className="text-left px-2 py-1.5 rounded-md text-[#b5bac1] hover:bg-[#35373c] hover:text-[#dbdee1] text-sm font-medium">
							Appearance
						</button>
						<button className="text-left px-2 py-1.5 rounded-md text-[#b5bac1] hover:bg-[#35373c] hover:text-[#dbdee1] text-sm font-medium">
							Voice & Video // WIP
						</button>
					</div>

					{/* Settings Content */}
					<div className="flex-1 p-6 overflow-y-auto">
						<DialogHeader className="mb-6">
							<DialogTitle className="text-xl font-bold text-white">
								My Account
							</DialogTitle>
						</DialogHeader>
						
						<div className="bg-[#1e1f22] rounded-xl p-4 flex flex-col gap-4">
							<h3 className="text-white font-bold mb-2">Profile Information</h3>
							<div className="text-[#b5bac1] text-sm">
								Settings logic will be implemented here later.
							</div>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
