import { useCallback, useLayoutEffect } from 'react';

import type { RefObject } from 'react';

type UseAutosizeTextareaParams = {
	value: string;
	textareaRef: RefObject<HTMLTextAreaElement | null>;
	minRows?: number;
	maxRows?: number;
};

function getPixels(value: string): number | null {
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function getMaxHeightPx(textarea: HTMLTextAreaElement, maxRows: number): number | null {
	const styles = window.getComputedStyle(textarea);

	const lineHeight = getPixels(styles.lineHeight);
	const paddingTop = getPixels(styles.paddingTop);
	const paddingBottom = getPixels(styles.paddingBottom);
	const borderTop = getPixels(styles.borderTopWidth);
	const borderBottom = getPixels(styles.borderBottomWidth);

	if (
		lineHeight === null ||
		paddingTop === null ||
		paddingBottom === null ||
		borderTop === null ||
		borderBottom === null
	) {
		return null;
	}

	return lineHeight * maxRows + paddingTop + paddingBottom + borderTop + borderBottom;
}

type AutosizeOptions = {
	minRows?: number;
	maxRows?: number;
};

export function autosizeTextarea(textarea: HTMLTextAreaElement, { minRows = 1, maxRows }: AutosizeOptions = {}) {
	textarea.rows = minRows;
	textarea.style.height = 'auto';

	const nextHeightPx = textarea.scrollHeight;

	if (typeof maxRows === 'number') {
		const maxHeightPx = getMaxHeightPx(textarea, maxRows);

		if (maxHeightPx !== null && nextHeightPx > maxHeightPx) {
			textarea.style.height = `${maxHeightPx}px`;
			textarea.style.overflowY = 'auto';
			return;
		}
	}

	textarea.style.height = `${nextHeightPx}px`;
	textarea.style.overflowY = 'hidden';
}

export function useAutosizeTextarea({ value, textareaRef, minRows = 1, maxRows = 6 }: UseAutosizeTextareaParams) {
	const autosize = useCallback(() => {
		const textarea = textareaRef.current;
		if (!textarea) return;

		autosizeTextarea(textarea, { minRows, maxRows });
	}, [maxRows, minRows, textareaRef]);

	useLayoutEffect(() => {
		autosize();
	}, [autosize, value]);

	return { autosize };
}
