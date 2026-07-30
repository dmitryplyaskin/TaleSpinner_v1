import { Tabs } from "@mantine/core";
import { type AppSettings } from "@shared/types/app-settings";
import { useUnit } from "effector-react";
import React, { useEffect, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { $appSettings, fetchAppSettingsFx, updateAppSettings } from "@model/app-settings";
import { Drawer } from "@ui/drawer";

import { BackgroundsTab } from "./backgrounds-tab";
import { DebugTab } from "./debug-tab";
import { GeneralTab } from "./general-tab";
import { SillyTavernImportTab } from "./sillytavern-import-tab";
import { ThemingTab } from "./theming-tab";
import { type AppSettingsTab } from "./types";

export const AppSettingsSidebar: React.FC = () => {
  const { t } = useTranslation();
  const appSettings = useUnit($appSettings);
  const [activeTab, setActiveTab] = useState<AppSettingsTab>("general");
  const methods = useForm<AppSettings>({
    defaultValues: appSettings,
  });

  useEffect(() => {
    const subscription = methods.watch((data) => {
      updateAppSettings(data);
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [methods]);

  useEffect(() => {
    const unsubscribe = fetchAppSettingsFx.doneData.watch((data) => {
      methods.reset(data);
    });

    return () => {
      unsubscribe();
    };
  }, [methods]);

  return (
    <Drawer name="appSettings" title={t("appSettings.title")}>
      <FormProvider {...methods}>
        <Tabs value={activeTab} onChange={(v) => setActiveTab((v as AppSettingsTab) ?? "general")} variant="outline">
          <Tabs.List mb="md">
            <Tabs.Tab value="general">{t("appSettings.tabs.general")}</Tabs.Tab>
            <Tabs.Tab value="theming">{t("appSettings.tabs.theming")}</Tabs.Tab>
            <Tabs.Tab value="backgrounds">{t("appSettings.tabs.backgrounds")}</Tabs.Tab>
            <Tabs.Tab value="sillytavern">{t("appSettings.tabs.sillytavern")}</Tabs.Tab>
            <Tabs.Tab value="debug">{t("appSettings.tabs.debug")}</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="general">
            <GeneralTab />
          </Tabs.Panel>
          <Tabs.Panel value="theming">
            <ThemingTab />
          </Tabs.Panel>
          <Tabs.Panel value="backgrounds">
            <BackgroundsTab />
          </Tabs.Panel>
          <Tabs.Panel value="sillytavern">
            <SillyTavernImportTab />
          </Tabs.Panel>
          <Tabs.Panel value="debug">
            <DebugTab />
          </Tabs.Panel>
        </Tabs>
      </FormProvider>
    </Drawer>
  );
};
