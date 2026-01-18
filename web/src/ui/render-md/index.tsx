import { Box, Code, Link, Text } from '@chakra-ui/react';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

import { quotePlugin } from './quote-plugin';
import { sanitizeSchema } from './sanitize-schema';

import type { BoxProps } from '@chakra-ui/react';
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
				// components={{ Quote: () =>  QuoteComponent }}
			>
				{content}
			</Markdown>
		</Box>
	);
};

const QuoteComponent: NonNullable<Components['q']> = (props) => {
	const { node: _node, className, ...rest } = props;
	// Chakra <Text> типизирован как <p>, поэтому для <q> используем нативный элемент
	// Disable UA quote rendering: we keep original quote characters in text.
	return (
		<q
			className={joinClassNames('ts-md__quote', className)}
			style={{ color: 'var(--chakra-colors-orange-500)', quotes: 'none' }}
			{...rest}
		/>
	);
};

function getComponents(variant: RenderMdVariant): Components {
	return {
		em(props) {
			const { node: _node, ...rest } = props;
			return <i style={{ color: 'red' }} {...rest} />;
		},
		q: QuoteComponent,
		a(props) {
			const { node: _node, href, target, rel, ...rest } = props;
			const nextRel = target === '_blank' ? mergeRel(rel, ['noopener', 'noreferrer']) : rel;

			return <Link href={href} target={target} rel={nextRel} {...rest} />;
		},
		img(props) {
			const { node: _node, style, ...rest } = props;
			return (
				<img
					{...rest}
					style={{
						borderRadius: 'var(--chakra-radii-lg)',
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
			return <Text my={variant === 'compact' ? 1 : 2} {...rest} />;
		},
		pre(props) {
			const { node: _node, ...rest } = props;
			return <Code {...rest} />;
		},
	};
}
