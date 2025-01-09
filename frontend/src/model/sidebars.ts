import { createEvent, createStore } from "effector";

type Sidebars = {
  settings: boolean;
  "chat-cards": boolean;
};

export const $sidebars = createStore<Sidebars>({
  settings: false,
  "chat-cards": false,
});

export const openSidebar = createEvent<keyof Sidebars>();
export const closeSidebar = createEvent<keyof Sidebars>();

$sidebars
  .on(openSidebar, (sidebars, sidebar) => ({
    ...sidebars,
    [sidebar]: true,
  }))
  .on(closeSidebar, (sidebars, sidebar) => ({
    ...sidebars,
    [sidebar]: false,
  }));
