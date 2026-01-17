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
	return <q style={{ color: 'var(--chakra-colors-orange-500)' }} {...rest} />;
};

const components: Components = {
	em(props) {
		const { node: _node, ...rest } = props;
		return <i style={{ color: 'red' }} {...rest} />;
	},
	q: QuoteComponent,
	p(props) {
		const { node: _node, ...rest } = props;
		return <Text my={2} {...rest} />;
	},
	pre(props) {
		const { node: _node, ...rest } = props;
		return <Code {...rest} />;
	},
};
