import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  start: ['intro'],
  userGuide: [
    {
      type: 'category',
      label: 'User Guide',
      items: [
        'user/getting-started',
        'user/chat-basics',
        'user/world-info',
        'user/llm-setup',
      ],
    },
  ],
  developerGuide: [
    {
      type: 'category',
      label: 'Developer Guide',
      items: [
        'dev/architecture/overview',
        'dev/frontend/state-and-modules',
        'dev/modules/world-info',
        'dev/docs-contributing',
      ],
    },
  ],
  apiReference: [
    {
      type: 'category',
      label: 'API Reference',
      items: [
        'dev/backend/api-overview',
        'dev/backend/api-endpoints',
      ],
    },
  ],
};

export default sidebars;
