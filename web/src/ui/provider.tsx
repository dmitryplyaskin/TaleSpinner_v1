import { MantineProvider, localStorageColorSchemeManager, useMantineColorScheme } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { useUnit } from "effector-react";
import { useEffect } from "react";

import { $activeUiThemePreset, $uiThemeSettings } from "../model/ui-themes";

import { buildAppTheme } from "./theme";
import { applyUiThemeRuntime } from "./ui-theme-runtime";
import { Z_INDEX } from "./z-index";

import type { UiThemeTypography } from "@shared/types/ui-theme";
import type { PropsWithChildren } from "react";


const colorSchemeManager = localStorageColorSchemeManager({
  key: "talespinner-color-scheme",
});
const appThemeCache = new Map<string, ReturnType<typeof buildAppTheme>>();

function getTypographySignature(typography: UiThemeTypography | null | undefined): string {
  if (!typography) return "default";
  return [
    typography.uiFontFamily,
    typography.chatFontFamily,
    typography.uiBaseFontSize,
    typography.chatBaseFontSize,
    typography.radiusXs,
    typography.radiusSm,
    typography.radiusMd,
    typography.radiusLg,
    typography.radiusXl,
  ].join("|");
}

function getCachedAppTheme(signature: string, typography: UiThemeTypography | null | undefined) {
  const cached = appThemeCache.get(signature);
  if (cached) return cached;
  const created = buildAppTheme({ typography: typography ?? null });
  appThemeCache.set(signature, created);
  return created;
}

function UiThemeSync() {
  const [activePreset, settings] = useUnit([$activeUiThemePreset, $uiThemeSettings]);
  const { colorScheme, setColorScheme } = useMantineColorScheme();

  useEffect(() => {
    applyUiThemeRuntime(activePreset?.payload);
  }, [activePreset?.payload]);

  useEffect(() => {
    if (!settings?.colorScheme) return;
    if (settings.colorScheme === colorScheme) return;
    setColorScheme(settings.colorScheme);
  }, [colorScheme, setColorScheme, settings?.colorScheme]);

  return null;
}

export function Provider({ children }: PropsWithChildren) {
  const activePreset = useUnit($activeUiThemePreset);
  const typographySignature = getTypographySignature(activePreset?.payload.typography);
  const appTheme = getCachedAppTheme(typographySignature, activePreset?.payload.typography);

  return (
    <MantineProvider theme={appTheme} defaultColorScheme="auto" colorSchemeManager={colorSchemeManager}>
      <ModalsProvider modalProps={{ zIndex: Z_INDEX.overlay.modal }}>
        <Notifications zIndex={Z_INDEX.overlay.alert} position="top-right" />
        <UiThemeSync />
        {children}
      </ModalsProvider>
    </MantineProvider>
  );
}

