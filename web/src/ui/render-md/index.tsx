import { Code, Text } from '@chakra-ui/react';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

import { quotePlugin } from './quote-plugin';

import type { Components } from 'react-markdown';

type RenderMdProps = {
	content: string;
};

export const RenderMd = ({ content }: RenderMdProps) => {
	return (
		<Markdown
			remarkPlugins={[remarkGfm, quotePlugin, remarkBreaks]}
			rehypePlugins={[rehypeRaw]}
			components={components}
			// components={{ Quote: () =>  QuoteComponent }}
		>
			{content}
		</Markdown>
	);
};

const QuoteComponent: NonNullable<Components['q']> = (props) => {
	const { node: _node, ...rest } = props;
	// Chakra <Text> типизирован как <p>, поэтому для <q> используем нативный элемент
	// Disable UA quote rendering: we keep original quote characters in text.
	return <q style={{ color: 'var(--chakra-colors-orange-500)', quotes: 'none' }} {...rest} />;
};

const components: Components = {
	em(props) {
		const { node: _node, ...rest } = props;
		return <i style={{ color: 'red' }} {...rest} />;
	},
	q: QuoteComponent,
	img(props) {
		const { node: _node, style, ...rest } = props;
		return (
			<img
				{...rest}
				style={{
					display: 'block',
					width: '100%',
					maxWidth: '100%',
					height: 'auto',
					borderRadius: 'var(--chakra-radii-lg)',
					...style,
				}}
			/>
		);
	},
	p(props) {
		const { node: _node, ...rest } = props;
		return <Text my={2} {...rest} />;
	},
	pre(props) {
		const { node: _node, ...rest } = props;
		return <Code {...rest} />;
	},
};
