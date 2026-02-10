import { createTheme } from "@mantine/core";
import { DEFAULT_UI_THEME_TYPOGRAPHY, type UiThemeTypography } from "@shared/types/ui-theme";

import { Z_INDEX } from "./z-index";

type BuildAppThemeParams = {
  typography?: UiThemeTypography | null;
};

export function buildAppTheme(params?: BuildAppThemeParams) {
  const typography = params?.typography ?? DEFAULT_UI_THEME_TYPOGRAPHY;

  return createTheme({
    primaryColor: "cyan",
    defaultRadius: "md",
    fontFamily: typography.uiFontFamily,
    headings: {
      fontFamily: typography.uiFontFamily,
      fontWeight: "700",
    },
    radius: {
      xs: typography.radiusXs,
      sm: typography.radiusSm,
      md: typography.radiusMd,
      lg: typography.radiusLg,
      xl: typography.radiusXl,
    },
    components: {
      Button: {
        defaultProps: {
          radius: "md",
          size: "sm",
        },
      },
      ActionIcon: {
        defaultProps: {
          radius: "md",
          variant: "subtle",
        },
      },
      Paper: {
        defaultProps: {
          radius: "md",
        },
      },
      Card: {
        defaultProps: {
          radius: "md",
        },
      },
      Modal: {
        defaultProps: {
          radius: "md",
          shadow: "lg",
          padding: "md",
          zIndex: Z_INDEX.overlay.modal,
        },
      },
      Drawer: {
        defaultProps: {
          radius: "md",
          padding: 0,
          zIndex: Z_INDEX.overlay.drawer,
        },
      },
      Tooltip: {
        defaultProps: {
          withinPortal: true,
          zIndex: Z_INDEX.overlay.popup,
        },
      },
      Popover: {
        defaultProps: {
          withinPortal: true,
          zIndex: Z_INDEX.overlay.popup,
        },
      },
      Menu: {
        defaultProps: {
          withinPortal: true,
          zIndex: Z_INDEX.overlay.popup,
        },
      },
      TextInput: {
        defaultProps: {
          radius: "md",
        },
      },
      Textarea: {
        defaultProps: {
          radius: "md",
        },
      },
      Select: {
        defaultProps: {
          radius: "md",
        },
      },
    },
  });
}

