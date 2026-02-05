import type { OperationKind } from '@shared/types/operation-profiles';

export type OperationListItemVm = {
	opId: string;
	index: number;
	name: string;
	kind: OperationKind;
	enabled: boolean;
	required: boolean;
	depsCount: number;
};

export type OperationFilterState = {
	query: string;
	kind: 'all' | OperationKind;
	enabled: 'all' | 'enabled' | 'disabled';
	required: 'all' | 'required' | 'optional';
};

export type OperationStatsVm = {
	total: number;
	enabled: number;
	required: number;
	withDeps: number;
	filtered: number;
};

export type NodeEditorViewState = 'graph' | 'inspector';
