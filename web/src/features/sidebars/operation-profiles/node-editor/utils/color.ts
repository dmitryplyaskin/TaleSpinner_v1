export type Rgb = { r: number; g: number; b: number };

export const DEFAULT_GROUP_COLOR_HEX = '#4c6ef5';

let cachedCtx: CanvasRenderingContext2D | null = null;

function getCanvasCtx(): CanvasRenderingContext2D | null {
	if (typeof document === 'undefined') return null;
	if (cachedCtx) return cachedCtx;

	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;

	cachedCtx = ctx;
	return ctx;
}

function clamp255(v: number): number {
	if (!Number.isFinite(v)) return 0;
	return Math.min(255, Math.max(0, Math.round(v)));
}

export function rgbToHex(rgb: Rgb): string {
	const toHex = (n: number) => clamp255(n).toString(16).padStart(2, '0');
	return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

/**
 * Parses and normalizes a CSS color string into RGB.
 *
 * Supports named colors / hsl(...) / hex / rgb(...), via Canvas normalization.
 * Returns null for invalid inputs.
 */
export function parseCssColorToRgb(input: string): Rgb | null {
	const ctx = getCanvasCtx();
	if (!ctx) return null;

	const raw = (input ?? '').trim();
	if (!raw) return null;

	const before = String(ctx.fillStyle);
	let normalized: string;
	try {
		ctx.fillStyle = raw;
		normalized = String(ctx.fillStyle);
	} catch {
		return null;
	}

	// Invalid colors keep previous value. Confirm using a sentinel.
	if (normalized === before) {
		ctx.fillStyle = '#000';
		const sentinel = String(ctx.fillStyle);
		try {
			ctx.fillStyle = raw;
		} catch {
			return null;
		}
		if (String(ctx.fillStyle) === sentinel) return null;
		normalized = String(ctx.fillStyle);
	}

	if (normalized.startsWith('#')) {
		const hex = normalized.slice(1);
		if (hex.length === 3) {
			const r = parseInt(hex[0] + hex[0], 16);
			const g = parseInt(hex[1] + hex[1], 16);
			const b = parseInt(hex[2] + hex[2], 16);
			if ([r, g, b].every(Number.isFinite)) return { r, g, b };
			return null;
		}
		if (hex.length === 6) {
			const r = parseInt(hex.slice(0, 2), 16);
			const g = parseInt(hex.slice(2, 4), 16);
			const b = parseInt(hex.slice(4, 6), 16);
			if ([r, g, b].every(Number.isFinite)) return { r, g, b };
			return null;
		}
	}

	// rgb(...) / rgba(...)
	const m = normalized.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
	if (m) {
		const r = Number(m[1]);
		const g = Number(m[2]);
		const b = Number(m[3]);
		if ([r, g, b].every((v) => Number.isFinite(v) && v >= 0 && v <= 255)) return { r, g, b };
	}

	return null;
}

export function normalizeCssColorToRgb(input: string | undefined, fallback: Rgb): Rgb {
	return parseCssColorToRgb(input ?? '') ?? fallback;
}

export function normalizeCssColorToHex(input: string | undefined, fallbackHex: string = DEFAULT_GROUP_COLOR_HEX): string {
	const fallbackRgb = parseCssColorToRgb(fallbackHex) ?? { r: 76, g: 110, b: 245 };
	return rgbToHex(normalizeCssColorToRgb(input, fallbackRgb));
}

export function normalizeCssColorToOpaqueRgbString(input: string | undefined, fallbackHex: string = DEFAULT_GROUP_COLOR_HEX): string {
	const rgb = normalizeCssColorToRgb(input, parseCssColorToRgb(fallbackHex) ?? { r: 76, g: 110, b: 245 });
	return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

export function getGroupColors(baseColor: string | undefined, opts?: { alpha?: number; fallbackHex?: string }): { base: string; bg: string } {
	const alpha = typeof opts?.alpha === 'number' ? opts.alpha : 0.08;
	const fallbackHex = opts?.fallbackHex ?? DEFAULT_GROUP_COLOR_HEX;
	const rgb = normalizeCssColorToRgb(baseColor, parseCssColorToRgb(fallbackHex) ?? { r: 76, g: 110, b: 245 });
	return {
		base: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
		bg: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`,
	};
}


