import { Anchor, Box, Code, Text, type BoxProps } from '@mantine/core';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

import { quotePlugin } from './quote-plugin';
import { sanitizeSchema } from './sanitize-schema';

import type { Components } from 'react-markdown';

type RenderMdVariant = 'default' | 'compact';

type RenderMdProps = {
	content: string;
	variant?: RenderMdVariant;
	containerProps?: Omit<BoxProps, 'children'>;
};

function joinClassNames(...values: Array<string | undefined>): string | undefined {
	const out = values.filter(Boolean).join(' ').trim();
	return out.length > 0 ? out : undefined;
}

function mergeRel(rel: string | undefined, requiredTokens: string[]): string | undefined {
	const tokens = new Set(
		(rel ?? '')
			.split(/\s+/)
			.map((x) => x.trim())
			.filter(Boolean),
	);
	for (const tok of requiredTokens) tokens.add(tok);
	const out = Array.from(tokens).join(' ').trim();
	return out.length > 0 ? out : undefined;
}

export const RenderMd = ({ content, variant = 'default', containerProps }: RenderMdProps) => {
	const { className, ...restContainer } = containerProps ?? {};

	return (
		<Box {...restContainer} className={joinClassNames('ts-md', className)} data-variant={variant}>
			<Markdown
				remarkPlugins={[remarkGfm, quotePlugin, remarkBreaks]}
				rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
		components={getComponents(variant)}
		>
			{content}
		</Markdown>
	</Box>
	);
};

const QuoteComponent: NonNullable<Components['q']> = (props) => {
	const { node: _node, className, ...rest } = props;
	// Disable UA quote rendering: we keep original quote characters in text.
	return (
		<q
			className={joinClassNames('ts-md__quote', className)}
			style={{ color: 'var(--mantine-color-orange-6)', quotes: 'none' }}
			{...rest}
		/>
	);
};

function getComponents(variant: RenderMdVariant): Components {
	return {
		em(props) {
			const { node: _node, ...rest } = props;
			return <em {...rest} />;
		},
		q: QuoteComponent,
		a(props) {
			const { node: _node, href, target, rel, ...rest } = props;
			const nextRel = target === '_blank' ? mergeRel(rel, ['noopener', 'noreferrer']) : rel;

			return <Anchor href={href} target={target} rel={nextRel} {...rest} />;
		},
		img(props) {
			const { node: _node, style, ...rest } = props;
			return (
				<img
					{...rest}
					style={{
						borderRadius: 'var(--mantine-radius-md)',
						...style,
						display: 'block',
						maxWidth: '100%',
						height: 'auto',
						width: '100%',
					}}
				/>
			);
		},
		p(props) {
			const { node: _node, ...rest } = props;
			return <Text my={variant === 'compact' ? 4 : 8} lh={1.65} {...rest} />;
		},
		pre(props) {
			const { node: _node, ...rest } = props;
			return <Code block {...rest} />;
		},
	};
}
