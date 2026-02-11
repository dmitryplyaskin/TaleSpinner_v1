import {
  Accordion,
  Box,
  Button,
  Checkbox,
  FileButton,
  Group,
  Select,
  SegmentedControl,
  Stack,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Title,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import { type AppSettings } from "@shared/types/app-settings";
import {
  DEFAULT_UI_THEME_PAYLOAD,
  UI_THEME_BUILT_IN_IDS,
  UI_THEME_EXPORT_TYPE,
  type UiThemeExportV1,
} from "@shared/types/ui-theme";
import { useUnit } from "effector-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { $appDebugEnabled, setAppDebugEnabled } from "@model/app-debug";
import { $appSettings, fetchAppSettingsFx, updateAppSettings } from "@model/app-settings";
import {
  $chatGenerationLogFilters,
  CHAT_GENERATION_LOG_FILTER_DEFINITIONS,
  applyOperationAndSnapshotsLogPreset,
  disableAllChatGenerationLogFilters,
  enableAllChatGenerationLogFilters,
  resetChatGenerationLogFilters,
  setChatGenerationLogFilter,
} from "@model/chat-generation-debug";
import {
  $activeUiThemePreset,
  $uiThemePresets,
  $uiThemeSettings,
  createUiThemePresetFx,
  deleteUiThemePresetFx,
  exportUiThemePresetFx,
  importUiThemePresetsFx,
  patchUiThemeSettingsFx,
  updateUiThemePresetFx,
} from "@model/ui-themes";
import { Drawer } from "@ui/drawer";
import { FormCheckbox, FormSelect } from "@ui/form-components";
import { toaster } from "@ui/toaster";

import { downloadJsonFile } from "../../../api/ui-theme";

type AppSettingsTab = "general" | "theming" | "debug";
type ColorSchemeValue = "light" | "dark" | "auto";

function cloneValue<T>(input: T): T {
  return JSON.parse(JSON.stringify(input)) as T;
}

function resolveNextPresetName(baseName: string, usedNames: Set<string>): string {
  const trimmed = baseName.trim();
  if (!usedNames.has(trimmed)) return trimmed;
  for (let idx = 2; idx <= 9999; idx += 1) {
    const candidate = `${trimmed} ${idx}`;
    if (!usedNames.has(candidate)) return candidate;
  }
  return `${trimmed} ${Date.now()}`;
}

export const AppSettingsSidebar: React.FC = () => {
  const { t } = useTranslation();
  const [appSettings, appDebugEnabled, presets, settings, activePreset] = useUnit([
    $appSettings,
    $appDebugEnabled,
    $uiThemePresets,
    $uiThemeSettings,
    $activeUiThemePreset,
  ]);
  const debugLogFilters = useUnit($chatGenerationLogFilters);
  const [activeTab, setActiveTab] = useState<AppSettingsTab>("general");
  const [draftPreset, setDraftPreset] = useState<typeof activePreset>(null);
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme("light");
  const selectedColorScheme: ColorSchemeValue =
    settings?.colorScheme ?? (colorScheme === "auto" ? computedColorScheme : colorScheme);

  const languageOptions = [
    { value: "ru", label: t("appSettings.languages.ru") },
    { value: "en", label: t("appSettings.languages.en") },
  ];
  const presetOptions = useMemo(() => presets.map((x) => ({ value: x.presetId, label: x.name })), [presets]);
  const selectedPresetId = settings?.activePresetId ?? activePreset?.presetId ?? null;
  const activePresetRef = useRef(activePreset);
  const debugLogFilterItems = useMemo(
    () =>
      CHAT_GENERATION_LOG_FILTER_DEFINITIONS.map((item) => ({
        ...item,
        label: t(item.labelKey),
        description: t(item.descriptionKey),
      })),
    [t]
  );

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

  useEffect(() => {
    activePresetRef.current = activePreset;
  }, [activePreset]);

  useEffect(() => {
    setDraftPreset(activePresetRef.current ? cloneValue(activePresetRef.current) : null);
  }, [activePreset?.presetId, activePreset?.version]);

  const updateToken = (
    tokenType: "lightTokens" | "darkTokens",
    tokenKey: string,
    tokenValue: string
  ) => {
    setDraftPreset((prev) => {
      if (!prev) return prev;
      const next = cloneValue(prev);
      next.payload[tokenType][tokenKey] = tokenValue;
      return next;
    });
  };

  const handleApplyColorScheme = (value: string) => {
    const next = value as ColorSchemeValue;
    if (settings?.colorScheme === next) return;
    setColorScheme(next);
    void patchUiThemeSettingsFx({ colorScheme: next });
  };

  const handleSelectPreset = (presetId: string | null) => {
    if (!presetId) return;
    if (settings?.activePresetId === presetId) return;
    void patchUiThemeSettingsFx({ activePresetId: presetId });
  };

  const handleCreateNewPreset = () => {
    const usedNames = new Set(presets.map((item) => item.name));
    const nextName = resolveNextPresetName(t("appSettings.theming.defaults.newPresetName"), usedNames);

    const defaultPresetPayload =
      presets.find((item) => item.presetId === UI_THEME_BUILT_IN_IDS.default)?.payload ?? DEFAULT_UI_THEME_PAYLOAD;

    void createUiThemePresetFx({
      name: nextName,
      payload: cloneValue(defaultPresetPayload),
    }).then((created) => {
      void patchUiThemeSettingsFx({ activePresetId: created.presetId });
    });
  };

  const handleCreatePresetCopy = () => {
    const source = draftPreset ?? activePreset;
    if (!source) return;

    const usedNames = new Set(presets.map((item) => item.name));
    const nextName = resolveNextPresetName(`${source.name} (copy)`, usedNames);

    void createUiThemePresetFx({
      name: nextName,
      description: source.description,
      payload: cloneValue(source.payload),
    }).then((created) => {
      void patchUiThemeSettingsFx({ activePresetId: created.presetId });
    });
  };

  const handleSavePreset = () => {
    if (!draftPreset || draftPreset.builtIn) return;
    void updateUiThemePresetFx({
      presetId: draftPreset.presetId,
      name: draftPreset.name,
      description: draftPreset.description ?? null,
      payload: draftPreset.payload,
    });
  };

  const handleDeletePreset = () => {
    if (!draftPreset || draftPreset.builtIn) return;
    if (!window.confirm(t("appSettings.theming.confirm.deletePreset"))) return;
    void deleteUiThemePresetFx(draftPreset.presetId);
  };

  const handleExportPreset = async () => {
    if (!draftPreset) return;
    try {
      const exported = await exportUiThemePresetFx(draftPreset.presetId);
      downloadJsonFile(`ui-theme-${draftPreset.name}.json`, exported);
    } catch (error) {
      toaster.error({
        title: t("appSettings.theming.toasts.exportFailed"),
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleImportPreset = async (file: File | null) => {
    if (!file) return;
    try {
      const content = await file.text();
      const parsed = JSON.parse(content) as UiThemeExportV1 | UiThemeExportV1[];
      const items = Array.isArray(parsed) ? parsed : [parsed];
      if (items.some((item) => item?.type !== UI_THEME_EXPORT_TYPE)) {
        throw new Error(t("appSettings.theming.errors.invalidFormat"));
      }
      const imported = await importUiThemePresetsFx(items);
      const first = imported.created[0];
      if (first) {
        await patchUiThemeSettingsFx({ activePresetId: first.presetId });
      }
    } catch (error) {
      toaster.error({
        title: t("appSettings.theming.toasts.importFailed"),
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return (
    <Drawer name="appSettings" title={t("appSettings.title")}>
      <FormProvider {...methods}>
        <Tabs value={activeTab} onChange={(v) => setActiveTab((v as AppSettingsTab) ?? "general")} variant="outline">
          <Tabs.List mb="md">
            <Tabs.Tab value="general">{t("appSettings.tabs.general")}</Tabs.Tab>
            <Tabs.Tab value="theming">{t("appSettings.tabs.theming")}</Tabs.Tab>
            <Tabs.Tab value="debug">{t("appSettings.tabs.debug")}</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="general">
            <Stack gap="lg">
              <Box>
                <Title order={4} mb="md">
                  {t("appSettings.sections.general")}
                </Title>

                <Stack gap="md">
                  <FormSelect
                    name="language"
                    label={t("appSettings.language.label")}
                    selectProps={{
                      options: languageOptions,
                      allowDeselect: false,
                      comboboxProps: { withinPortal: false },
                    }}
                  />

                  <FormCheckbox
                    name="openLastChat"
                    label={t("appSettings.openLastChat.label")}
                    infoTip={t("appSettings.openLastChat.info")}
                  />

                  <FormCheckbox
                    name="autoSelectCurrentPersona"
                    label={t("appSettings.autoSelectCurrentPersona.label")}
                    infoTip={t("appSettings.autoSelectCurrentPersona.info")}
                  />
                </Stack>
              </Box>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="theming">
            <Stack gap="md">
              <Text size="sm" fw={600}>
                {t("appSettings.theming.mode")}
              </Text>
              <SegmentedControl
                fullWidth
                value={selectedColorScheme}
                onChange={handleApplyColorScheme}
                data={[
                  { label: t("appSettings.theming.light"), value: "light" },
                  { label: t("appSettings.theming.dark"), value: "dark" },
                  { label: t("appSettings.theming.auto"), value: "auto" },
                ]}
              />

              <Select
                label={t("appSettings.theming.activePreset")}
                data={presetOptions}
                value={selectedPresetId}
                onChange={handleSelectPreset}
                allowDeselect={false}
                comboboxProps={{ withinPortal: false }}
              />

              <Group gap="xs">
                <Button size="xs" variant="light" onClick={handleCreateNewPreset}>
                  {t("appSettings.theming.actions.createNew")}
                </Button>
                <Button size="xs" variant="light" onClick={handleCreatePresetCopy} disabled={!activePreset}>
                  {t("appSettings.theming.actions.createCopy")}
                </Button>
                <FileButton onChange={handleImportPreset} accept=".json">
                  {(props) => (
                    <Button {...props} size="xs" variant="default">
                      {t("appSettings.theming.actions.import")}
                    </Button>
                  )}
                </FileButton>
                <Button size="xs" variant="default" onClick={handleExportPreset} disabled={!draftPreset}>
                  {t("appSettings.theming.actions.export")}
                </Button>
                <Button
                  size="xs"
                  color="red"
                  variant="light"
                  onClick={handleDeletePreset}
                  disabled={!draftPreset || Boolean(draftPreset.builtIn)}
                >
                  {t("appSettings.theming.actions.delete")}
                </Button>
              </Group>

              {draftPreset && (
                <Stack gap="sm">
                  <TextInput
                    label={t("appSettings.theming.presetName")}
                    value={draftPreset.name}
                    onChange={(event) =>
                      setDraftPreset((prev) => (prev ? { ...prev, name: event.currentTarget.value } : prev))
                    }
                    disabled={draftPreset.builtIn}
                  />
                  <Textarea
                    label={t("appSettings.theming.presetDescription")}
                    value={draftPreset.description ?? ""}
                    onChange={(event) =>
                      setDraftPreset((prev) =>
                        prev ? { ...prev, description: event.currentTarget.value || undefined } : prev
                      )
                    }
                    autosize
                    minRows={2}
                    disabled={draftPreset.builtIn}
                  />

                  {draftPreset.builtIn && (
                    <Text size="xs" c="dimmed">
                      {t("appSettings.theming.builtInReadOnly")}
                    </Text>
                  )}

                  <Accordion variant="separated" defaultValue="light">
                    <Accordion.Item value="light">
                      <Accordion.Control>{t("appSettings.theming.lightTokens")}</Accordion.Control>
                      <Accordion.Panel>
                        <Stack gap="xs">
                          {Object.entries(draftPreset.payload.lightTokens).map(([key, value]) => (
                            <TextInput
                              key={`light-${key}`}
                              label={key}
                              value={value}
                              onChange={(event) => updateToken("lightTokens", key, event.currentTarget.value)}
                              disabled={draftPreset.builtIn}
                            />
                          ))}
                        </Stack>
                      </Accordion.Panel>
                    </Accordion.Item>

                    <Accordion.Item value="dark">
                      <Accordion.Control>{t("appSettings.theming.darkTokens")}</Accordion.Control>
                      <Accordion.Panel>
                        <Stack gap="xs">
                          {Object.entries(draftPreset.payload.darkTokens).map(([key, value]) => (
                            <TextInput
                              key={`dark-${key}`}
                              label={key}
                              value={value}
                              onChange={(event) => updateToken("darkTokens", key, event.currentTarget.value)}
                              disabled={draftPreset.builtIn}
                            />
                          ))}
                        </Stack>
                      </Accordion.Panel>
                    </Accordion.Item>

                    <Accordion.Item value="typography">
                      <Accordion.Control>{t("appSettings.theming.typography")}</Accordion.Control>
                      <Accordion.Panel>
                        <Stack gap="xs">
                          <TextInput
                            label="uiFontFamily"
                            value={draftPreset.payload.typography.uiFontFamily}
                            onChange={(event) =>
                              setDraftPreset((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      payload: {
                                        ...prev.payload,
                                        typography: {
                                          ...prev.payload.typography,
                                          uiFontFamily: event.currentTarget.value,
                                        },
                                      },
                                    }
                                  : prev
                              )
                            }
                            disabled={draftPreset.builtIn}
                          />
                          <TextInput
                            label="chatFontFamily"
                            value={draftPreset.payload.typography.chatFontFamily}
                            onChange={(event) =>
                              setDraftPreset((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      payload: {
                                        ...prev.payload,
                                        typography: {
                                          ...prev.payload.typography,
                                          chatFontFamily: event.currentTarget.value,
                                        },
                                      },
                                    }
                                  : prev
                              )
                            }
                            disabled={draftPreset.builtIn}
                          />
                          <TextInput
                            label="uiBaseFontSize"
                            value={draftPreset.payload.typography.uiBaseFontSize}
                            onChange={(event) =>
                              setDraftPreset((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      payload: {
                                        ...prev.payload,
                                        typography: {
                                          ...prev.payload.typography,
                                          uiBaseFontSize: event.currentTarget.value,
                                        },
                                      },
                                    }
                                  : prev
                              )
                            }
                            disabled={draftPreset.builtIn}
                          />
                          <TextInput
                            label="chatBaseFontSize"
                            value={draftPreset.payload.typography.chatBaseFontSize}
                            onChange={(event) =>
                              setDraftPreset((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      payload: {
                                        ...prev.payload,
                                        typography: {
                                          ...prev.payload.typography,
                                          chatBaseFontSize: event.currentTarget.value,
                                        },
                                      },
                                    }
                                  : prev
                              )
                            }
                            disabled={draftPreset.builtIn}
                          />
                        </Stack>
                      </Accordion.Panel>
                    </Accordion.Item>

                    <Accordion.Item value="markdown">
                      <Accordion.Control>{t("appSettings.theming.markdown")}</Accordion.Control>
                      <Accordion.Panel>
                        <Stack gap="xs">
                          <TextInput
                            label="fontSize"
                            value={draftPreset.payload.markdown.fontSize}
                            onChange={(event) =>
                              setDraftPreset((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      payload: {
                                        ...prev.payload,
                                        markdown: {
                                          ...prev.payload.markdown,
                                          fontSize: event.currentTarget.value,
                                        },
                                      },
                                    }
                                  : prev
                              )
                            }
                            disabled={draftPreset.builtIn}
                          />
                          <TextInput
                            label="lineHeight"
                            value={draftPreset.payload.markdown.lineHeight}
                            onChange={(event) =>
                              setDraftPreset((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      payload: {
                                        ...prev.payload,
                                        markdown: {
                                          ...prev.payload.markdown,
                                          lineHeight: event.currentTarget.value,
                                        },
                                      },
                                    }
                                  : prev
                              )
                            }
                            disabled={draftPreset.builtIn}
                          />
                          <TextInput
                            label="codeFontSize"
                            value={draftPreset.payload.markdown.codeFontSize}
                            onChange={(event) =>
                              setDraftPreset((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      payload: {
                                        ...prev.payload,
                                        markdown: {
                                          ...prev.payload.markdown,
                                          codeFontSize: event.currentTarget.value,
                                        },
                                      },
                                    }
                                  : prev
                              )
                            }
                            disabled={draftPreset.builtIn}
                          />
                        </Stack>
                      </Accordion.Panel>
                    </Accordion.Item>

                    <Accordion.Item value="css">
                      <Accordion.Control>{t("appSettings.theming.customCss")}</Accordion.Control>
                      <Accordion.Panel>
                        <Textarea
                          value={draftPreset.payload.customCss}
                          onChange={(event) =>
                            setDraftPreset((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    payload: { ...prev.payload, customCss: event.currentTarget.value },
                                  }
                                : prev
                            )
                          }
                          autosize
                          minRows={8}
                          maxRows={18}
                          disabled={draftPreset.builtIn}
                        />
                        <Text size="xs" c="dimmed" mt={6}>
                          {t("appSettings.theming.customCssHint")}
                        </Text>
                      </Accordion.Panel>
                    </Accordion.Item>
                  </Accordion>

                  <Group justify="flex-end">
                    <Button onClick={handleSavePreset} disabled={!draftPreset || draftPreset.builtIn}>
                      {t("appSettings.theming.actions.save")}
                    </Button>
                  </Group>
                </Stack>
              )}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="debug">
            <Stack gap="md">
              <Checkbox
                checked={appDebugEnabled}
                onChange={(event) => setAppDebugEnabled(event.currentTarget.checked)}
                label={t("appSettings.debug.label")}
              />
              <Text size="xs" c="dimmed">
                {t("appSettings.debug.info")}
              </Text>

              <Box>
                <Text size="sm" fw={600} mb={4}>
                  {t("appSettings.debug.logsTitle")}
                </Text>
                <Text size="xs" c="dimmed" mb="xs">
                  {t("appSettings.debug.logsInfo")}
                </Text>

                <Group gap="xs" mb="xs">
                  <Button size="xs" variant="light" onClick={() => enableAllChatGenerationLogFilters()}>
                    {t("appSettings.debug.actions.enableAll")}
                  </Button>
                  <Button size="xs" variant="light" onClick={() => disableAllChatGenerationLogFilters()}>
                    {t("appSettings.debug.actions.disableAll")}
                  </Button>
                  <Button size="xs" variant="light" onClick={() => applyOperationAndSnapshotsLogPreset()}>
                    {t("appSettings.debug.actions.operationsAndSnapshots")}
                  </Button>
                  <Button size="xs" variant="default" onClick={() => resetChatGenerationLogFilters()}>
                    {t("appSettings.debug.actions.resetDefaults")}
                  </Button>
                </Group>

                <Stack gap="xs">
                  {debugLogFilterItems.map((item) => (
                    <Box
                      key={item.id}
                      p="xs"
                      style={{
                        border: "1px solid var(--mantine-color-default-border)",
                        borderRadius: "var(--mantine-radius-sm)",
                      }}
                    >
                      <Checkbox
                        checked={Boolean(debugLogFilters[item.id])}
                        onChange={(event) =>
                          setChatGenerationLogFilter({
                            id: item.id,
                            enabled: event.currentTarget.checked,
                          })
                        }
                        label={item.label}
                      />
                      <Text size="xs" c="dimmed" mt={4} ml={28}>
                        {item.description}
                      </Text>
                    </Box>
                  ))}
                </Stack>
              </Box>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </FormProvider>
    </Drawer>
  );
};
