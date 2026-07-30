import { Button, Checkbox, Group, Modal, Stack, Text } from "@mantine/core";
import { useUnit } from "effector-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { $currentChat, $currentEntityProfile, $entityProfiles, loadEntityProfilesFx, selectEntityProfile, setChatInstructionRequested } from "@model/chat-core";
import { instructionSelected, loadInstructionsFx } from "@model/instructions";
import { loadOperationBlocksFx } from "@model/operation-blocks";
import { $operationProfileSettings, $operationProfiles, loadActiveOperationProfileFx, loadOperationProfilesFx, setActiveOperationProfileRequested } from "@model/operation-profiles";
import { samplersModel } from "@model/samplers";
import { $activeUiThemePreset, loadUiThemePresetsFx, loadUiThemeSettingsFx, patchUiThemeSettingsFx } from "@model/ui-themes";
import { $worldInfoBooks, $worldInfoChatBindings, loadWorldInfoBooksFx, worldInfoBookSelected } from "@model/world-info";
import { EXPORT_FILE_ICON, IMPORT_FILE_ICON } from "@ui/file-transfer-icons";
import { IconButtonWithTooltip } from "@ui/icon-button-with-tooltip";
import { toaster } from "@ui/toaster";

import { downloadBlobFile, exportBundle, importBundle } from "../../../api/bundles";
import {
  getBundleExportCandidateCopy,
  resolveBundleAutoApplyTargets,
  resolveInstructionBundleExportCandidates,
  toggleBundleCandidateSelection,
} from "../common/bundle-helpers";

import type { InstructionDto } from "../../../api/instructions";

type Props = {
  selectedInstruction: InstructionDto | null;
};

export const InstructionBundleActions: React.FC<Props> = ({ selectedInstruction }) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [opened, setOpened] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [
    currentChat,
    currentEntityProfile,
    entityProfiles,
    operationProfiles,
    operationProfileSettings,
    activeUiThemePreset,
    samplerPresets,
    samplerSettings,
    worldInfoBooks,
    worldInfoChatBindings,
  ] = useUnit([
    $currentChat,
    $currentEntityProfile,
    $entityProfiles,
    $operationProfiles,
    $operationProfileSettings,
    $activeUiThemePreset,
    samplersModel.$items,
    samplersModel.$settings,
    $worldInfoBooks,
    $worldInfoChatBindings,
  ]);
  const [
    refreshInstructions,
    refreshProfiles,
    refreshProfileSettings,
    refreshBlocks,
    refreshThemes,
    refreshThemeSettings,
    refreshSamplers,
    refreshSamplerSettings,
    refreshEntities,
    refreshWorldInfo,
    applySamplerPreset,
    applyEntityProfile,
    applyWorldInfoBook,
    applyOperationProfile,
    applyThemePreset,
  ] = useUnit([
    loadInstructionsFx,
    loadOperationProfilesFx,
    loadActiveOperationProfileFx,
    loadOperationBlocksFx,
    loadUiThemePresetsFx,
    loadUiThemeSettingsFx,
    samplersModel.getItemsFx,
    samplersModel.getSettingsFx,
    loadEntityProfilesFx,
    loadWorldInfoBooksFx,
    samplersModel.updateSettingsFx,
    selectEntityProfile,
    worldInfoBookSelected,
    setActiveOperationProfileRequested,
    patchUiThemeSettingsFx,
  ]);

  const activeOperationProfile = useMemo(() => {
    const activeId = operationProfileSettings?.activeProfileId ?? null;
    return operationProfiles.find((item) => item.profileId === activeId) ?? null;
  }, [operationProfileSettings?.activeProfileId, operationProfiles]);
  const activeSamplerPreset = useMemo(() => {
    const activeId = samplerSettings?.selectedId ?? null;
    return samplerPresets.find((item) => item.id === activeId) ?? null;
  }, [samplerPresets, samplerSettings?.selectedId]);

  const currentWorldInfoBooks = useMemo(() => {
    const enabledIds = new Set(
      worldInfoChatBindings.filter((item) => item.enabled).map((item) => item.bookId)
    );
    return worldInfoBooks
      .filter((item) => enabledIds.has(item.id))
      .map((item) => ({ id: item.id, name: item.name }));
  }, [worldInfoBooks, worldInfoChatBindings]);

  const candidates = useMemo(() => {
    if (!selectedInstruction) return [];
    return resolveInstructionBundleExportCandidates({
      sourceInstruction: { id: selectedInstruction.id, name: selectedInstruction.name },
      activeOperationProfile: activeOperationProfile
        ? { profileId: activeOperationProfile.profileId, name: activeOperationProfile.name }
        : null,
      activeUiThemePreset: activeUiThemePreset
        ? { presetId: activeUiThemePreset.presetId, name: activeUiThemePreset.name }
        : null,
      activeSamplerPreset: activeSamplerPreset ? { presetId: activeSamplerPreset.id, name: activeSamplerPreset.name } : null,
      currentEntityProfile: currentEntityProfile
        ? { id: currentEntityProfile.id, name: currentEntityProfile.name }
        : null,
      currentWorldInfoBooks,
    });
  }, [activeOperationProfile, activeSamplerPreset, activeUiThemePreset, currentEntityProfile, currentWorldInfoBooks, selectedInstruction]);

  useEffect(() => {
    if (!opened) return;
    setSelectedKeys(candidates.filter((item) => item.checkedByDefault).map((item) => item.key));
  }, [candidates, opened]);

  const handleBundleExport = async () => {
    if (!selectedInstruction) return;
    const selections = candidates
      .filter((item) => selectedKeys.includes(item.key))
      .map((item) => item.handle);
    if (selections.length === 0) {
      toaster.error({
        title: t("instructions.bundle.toasts.exportErrorTitle"),
        description: t("instructions.bundle.toasts.selectAtLeastOne"),
      });
      return;
    }

    const exported = await exportBundle({
      source: { kind: "instruction", id: selectedInstruction.id },
      selections,
      format: "auto",
    });
    downloadBlobFile(exported.filename, exported.blob);
    setOpened(false);
  };

  const handleBundleImport = async (file: File | null) => {
    if (!file) return;
    const imported = await importBundle(file);
    const [, , , , , , , , reloadedEntities] = await Promise.all([
      refreshInstructions(),
      refreshProfiles(),
      refreshProfileSettings(),
      refreshBlocks(),
      refreshThemes(),
      refreshThemeSettings(),
      refreshSamplers(),
      refreshSamplerSettings(),
      refreshEntities(),
      refreshWorldInfo(),
    ]);

    const applyTargets = resolveBundleAutoApplyTargets(imported);
    if (applyTargets.instructionId) {
      if (currentChat?.id) {
        setChatInstructionRequested({ instructionId: applyTargets.instructionId });
      } else {
        instructionSelected(applyTargets.instructionId);
      }
    }
    if (applyTargets.operationProfileId) {
      applyOperationProfile(applyTargets.operationProfileId);
    }
    if (applyTargets.uiThemePresetId) {
      await applyThemePreset({ activePresetId: applyTargets.uiThemePresetId });
    }
    if (applyTargets.samplerPresetId) {
      await applySamplerPreset({ selectedId: applyTargets.samplerPresetId });
    }
    if (applyTargets.entityProfileId) {
      const profile = (reloadedEntities ?? entityProfiles).find((item) => item.id === applyTargets.entityProfileId);
      if (profile) {
        applyEntityProfile(profile);
      }
    }
    if (applyTargets.worldInfoBookId) {
      applyWorldInfoBook(applyTargets.worldInfoBookId);
    }
    if (applyTargets.warnings.length > 0) {
      toaster.warning({
        title: t("instructions.bundle.toasts.importWarningTitle"),
        description: applyTargets.warnings.join(" "),
      });
    }
    const totalImported =
      imported.created.instructions.length +
      imported.created.operationProfiles.length +
      imported.created.entityProfiles.length +
      imported.created.uiThemePresets.length +
      imported.created.samplerPresets.length +
      imported.created.worldInfoBooks.length;
    toaster.success({
      title: t("instructions.bundle.toasts.importSuccessTitle"),
      description: t("instructions.bundle.toasts.importedCount", { count: totalImported }),
    });
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.tsbundle"
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0] ?? null;
          void handleBundleImport(file)
            .catch((error) => {
              toaster.error({
                title: t("instructions.bundle.toasts.importErrorTitle"),
                description: error instanceof Error ? error.message : String(error),
              });
            })
            .finally(() => {
              event.currentTarget.value = "";
            });
        }}
      />

      <Modal opened={opened} onClose={() => setOpened(false)} title={t("instructions.bundle.dialogs.exportTitle")} centered>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {t("instructions.bundle.dialogs.exportDescription")}
          </Text>
          {candidates.map((candidate) => {
            const copy = getBundleExportCandidateCopy(candidate);

            return (
              <Checkbox
                key={candidate.key}
                checked={selectedKeys.includes(candidate.key)}
                onChange={(event) => {
                  const checked = event.currentTarget.checked;
                  setSelectedKeys((current) =>
                    toggleBundleCandidateSelection(current, candidate.key, checked)
                  );
                }}
                label={`${t(copy.kindLabelKey)}: ${candidate.label}`}
                description={t(copy.descriptionKey)}
              />
            );
          })}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setOpened(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void handleBundleExport()} disabled={!selectedInstruction}>
              {t("instructions.bundle.actions.export")}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <IconButtonWithTooltip
        tooltip={t("instructions.bundle.actions.import")}
        icon={<IMPORT_FILE_ICON size={16} />}
        aria-label={t("instructions.bundle.actions.import")}
        onClick={() => fileInputRef.current?.click()}
      />
      <IconButtonWithTooltip
        tooltip={t("instructions.bundle.actions.export")}
        icon={<EXPORT_FILE_ICON size={16} />}
        aria-label={t("instructions.bundle.actions.export")}
        disabled={!selectedInstruction}
        onClick={() => setOpened(true)}
      />
    </>
  );
};
