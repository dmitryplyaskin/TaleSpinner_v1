import {
  ActionIcon,
  AspectRatio,
  Box,
  Button,
  Card,
  FileButton,
  Group,
  Image,
  SimpleGrid,
  Stack,
  Text,
} from "@mantine/core";
import { useUnit } from "effector-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import {
  $activeAppBackgroundId,
  $appBackgroundCatalogError,
  $appBackgroundItems,
  deleteAppBackgroundFx,
  importAppBackgroundFx,
  loadAppBackgroundCatalogFx,
  setActiveAppBackgroundFx,
} from "@model/app-backgrounds";
import { TrashIcon } from "@ui/icons";


import { toAbsoluteAppBackgroundUrl } from "../../../api/app-backgrounds";

import type { AppBackgroundAsset } from "@shared/types/app-background";

function resolveBackgroundLabel(asset: AppBackgroundAsset, t: (key: string) => string): string {
  if (asset.id === "builtin:default") {
    return t("appSettings.backgrounds.builtInNames.default");
  }
  return asset.name;
}

export const BackgroundsTab = () => {
  const { t } = useTranslation();
  const [items, activeBackgroundId, catalogError, isLoading, isImporting, isDeleting, isSelecting] = useUnit([
    $appBackgroundItems,
    $activeAppBackgroundId,
    $appBackgroundCatalogError,
    loadAppBackgroundCatalogFx.pending,
    importAppBackgroundFx.pending,
    deleteAppBackgroundFx.pending,
    setActiveAppBackgroundFx.pending,
  ]);

  useEffect(() => {
    if (items.length === 0 && !isLoading && !catalogError) {
      void loadAppBackgroundCatalogFx();
    }
  }, [catalogError, isLoading, items.length]);

  const handleImport = (file: File | null) => {
    if (!file) return;
    void importAppBackgroundFx(file);
  };

  const handleSelect = (backgroundId: string) => {
    if (backgroundId === activeBackgroundId) return;
    void setActiveAppBackgroundFx(backgroundId);
  };

  if (isLoading && items.length === 0) {
    return <Text size="sm">{t("appSettings.backgrounds.states.loading")}</Text>;
  }

  if (catalogError && items.length === 0) {
    return (
      <Stack gap="sm">
        <Text size="sm" c="red">
          {t("appSettings.backgrounds.states.loadFailed")}
        </Text>
        <Text size="xs" c="dimmed">
          {catalogError}
        </Text>
        <Group>
          <Button size="xs" variant="default" onClick={() => void loadAppBackgroundCatalogFx()}>
            {t("appSettings.backgrounds.actions.retry")}
          </Button>
        </Group>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Text size="sm" c="dimmed">
          {t("appSettings.backgrounds.description")}
        </Text>
        <FileButton onChange={handleImport} accept="image/*">
          {(props) => (
            <Button {...props} size="xs" variant="default" loading={isImporting}>
              {t("appSettings.backgrounds.actions.import")}
            </Button>
          )}
        </FileButton>
      </Group>

      {items.length === 0 ? (
        <Text size="sm" c="dimmed">
          {t("appSettings.backgrounds.states.empty")}
        </Text>
      ) : (
        <SimpleGrid cols={{ base: 1, xs: 2, md: 3 }} spacing="sm">
          {items.map((item) => {
            const isActive = item.id === activeBackgroundId;
            const displayName = resolveBackgroundLabel(item, t);

            return (
              <Card
                key={item.id}
                withBorder
                radius="md"
                padding="xs"
                role="button"
                tabIndex={0}
                aria-pressed={isActive}
                onClick={() => handleSelect(item.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleSelect(item.id);
                  }
                }}
                style={{
                  cursor: "pointer",
                  borderColor: isActive ? "var(--ts-accent)" : "var(--mantine-color-default-border)",
                  boxShadow: isActive ? "0 0 0 1px var(--ts-accent)" : undefined,
                }}
              >
                <Card.Section>
                  <AspectRatio ratio={16 / 9}>
                    <Image src={toAbsoluteAppBackgroundUrl(item.imageUrl)} alt={displayName} fit="cover" />
                  </AspectRatio>
                </Card.Section>

                <Stack gap={6} mt="xs">
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Box style={{ minWidth: 0 }}>
                      <Text size="sm" fw={600} truncate="end">
                        {displayName}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {item.source === "builtin"
                          ? t("appSettings.backgrounds.labels.builtIn")
                          : t("appSettings.backgrounds.labels.imported")}
                      </Text>
                    </Box>

                    {item.deletable ? (
                      <ActionIcon
                        color="red"
                        variant="subtle"
                        aria-label={t("appSettings.backgrounds.actions.delete")}
                        disabled={isDeleting}
                        onClick={(event) => {
                          event.stopPropagation();
                          void deleteAppBackgroundFx(item.id);
                        }}
                      >
                        <TrashIcon size={16} />
                      </ActionIcon>
                    ) : null}
                  </Group>

                  <Text size="xs" c={isActive ? "cyan" : "dimmed"}>
                    {isActive
                      ? t("appSettings.backgrounds.labels.selected")
                      : isSelecting
                        ? t("appSettings.backgrounds.labels.selecting")
                        : t("appSettings.backgrounds.labels.clickToApply")}
                  </Text>
                </Stack>
              </Card>
            );
          })}
        </SimpleGrid>
      )}
    </Stack>
  );
};
