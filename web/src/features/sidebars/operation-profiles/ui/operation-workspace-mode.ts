export type CompactOperationView = 'list' | 'inspector';
export type OperationWorkspaceMode = 'split' | CompactOperationView;

type ResolveModeParams = {
	useSplitLayout: boolean;
	compactView: CompactOperationView;
	selectedOpId: string | null;
};

export function resolveOperationWorkspaceMode({
	useSplitLayout,
	compactView,
	selectedOpId,
}: ResolveModeParams): OperationWorkspaceMode {
	if (useSplitLayout) return 'split';
	if (compactView === 'inspector' && selectedOpId) return 'inspector';
	return 'list';
}

export function shouldShowBlockSettings(mode: OperationWorkspaceMode): boolean {
	return mode !== 'inspector';
}
