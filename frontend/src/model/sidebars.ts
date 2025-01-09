import { createEvent, createStore } from "effector";

type Sidebars = {
  settings: boolean;
  chatCards: boolean;
};

export const $sidebars = createStore<Sidebars>({
  settings: false,
  chatCards: false,
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
