import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import remarkBreaks from 'remark-breaks';
import { quotePlugin } from './quote-plugin';
import { Code, Text } from '@chakra-ui/react';

type RenderMdProps = {
	content: string;
};

export const RenderMd = ({ content }: RenderMdProps) => {
	return (
		<Markdown
			remarkPlugins={[remarkGfm, quotePlugin, remarkBreaks]}
			rehypePlugins={[rehypeRaw]}
			components={{
				em(props) {
					const { node, ...rest } = props;
					return <i style={{ color: 'red' }} {...rest} />;
				},
				q: QuoteComponent,
				p: (props) => {
					const { node, ...rest } = props;
					return <Text my={2} {...rest} />;
				},
				pre: (props) => {
					const { node, ...rest } = props;
					return <Code {...rest} />;
				},
			}}
			// components={{ Quote: () =>  QuoteComponent }}
		>
			{content}
		</Markdown>
	);
};

const QuoteComponent: React.FC = (props) => {
	const { node, ...rest } = props;
	return <Text as="q" color={'orange.500'} _before={{ content: 'none' }} _after={{ content: 'none' }} {...rest} />;
};
