### Отчёт: миграция фронтенда TaleSpinner с Chakra UI v3 на Mantine

Дата: 2026-01-18  
Проект: `web/` (Vite + React + TypeScript + Effector)

---

### Контекст и текущая архитектура UI

- **Точка входа**: `web/src/main.tsx` — сейчас оборачивает приложение в `Provider` из `web/src/ui/chakra-core-ui/provider.tsx`.
- **Chakra Provider**: `web/src/ui/chakra-core-ui/provider.tsx` использует `ChakraProvider value={defaultSystem}`.
- **Color mode**: `web/src/ui/chakra-core-ui/color-mode.tsx` использует `next-themes` (`ThemeProvider attribute="class"`).
- **Toasts**: `web/src/ui/chakra-core-ui/toaster.tsx` реализует `createToaster` и кастомный рендер.
- **Оверлеи** (тот самый “головняк” со слоями): в проекте уже есть ручные костыли на Chakra v3:
  - `web/src/ui/dialog.tsx` и `web/src/ui/drawer.tsx` используют `persistentElements` (например, `.chakra-popover__positioner`) чтобы выпадающие элементы не “ломались” поверх диалога/дровера.

Фактический “вес” Chakra сейчас:

- **Импортов Chakra**: ~68 файлов в `web/src` импортят `@chakra-ui/react` (включая `ui/chakra-core-ui/*` и фичи).
- **Оверлейная зона риска** (Dialog/Drawer/Popover/Menu/Select/Tooltip/Portal): встречается примерно в 28 файлах.

---

### Почему Mantine может быть более целесообразен здесь

- **Более “продуктовый” набор компонентов** из коробки (особенно селекты/комбобоксы/варианты ввода).
- **Меньше ручного glue-кода** для типовых UI-паттернов (модалки/нотификации/меню/поповеры).
- **Слойность/оверлеи** обычно решаются настройками `zIndex`, `withinPortal`, `ModalsProvider`, без необходимости “persistentElements”-костылей.

---

### Стратегия миграции (рекомендуется)

#### Вариант A (рекомендуемый): инкрементальная миграция через “острова”

Цель: снизить риск регрессий и не останавливать разработку фич.

- Сначала внедрить Mantine инфраструктуру (Provider/theme/notifications/modals).
- Затем переводить фичи по одной (например, начать со `features/sidebars/settings/*`, где много форм и селектов).
- На период миграции **разрешить сосуществование Chakra и Mantine**, но:
  - не смешивать компоненты в одном оверлее (например, Mantine Drawer внутри Chakra Dialog) без явной необходимости.

#### Вариант B: “Big bang”

Быстрее по календарю, но дороже по рискам: переписываются почти все `.tsx` за короткий период.

---

### План работ: что именно и где менять

#### 0) Подготовка и рамки

- **Цель**: заменить Chakra UI на Mantine в `web/`, сохранив Effector, react-hook-form и текущую структуру.
- **Критично сохранить UX**:
  - работающие оверлеи (Dialog/Drawer + выпадашки поверх них)
  - тема (light/dark)
  - уведомления (toasts)

#### 1) Зависимости (web/package.json)

Файл: `web/package.json`

Добавить зависимости Mantine (версии — актуальные на момент миграции):

- `@mantine/core`
- `@mantine/hooks`
- `@mantine/notifications` (замена Chakra toaster)
- `@mantine/modals` (единый менеджер модалок; опционально, но удобно)
- Опционально по факту использования:
  - `@mantine/dropzone` (если `file-upload`/drag&drop нужен)
  - `@mantine/dates` (если появятся даты)

После полного переезда удалить:

- `@chakra-ui/react`
- `@emotion/react` **(только если Mantine не использует Emotion в выбранной конфигурации)**.
  - В большинстве конфигураций Mantine использует Emotion, так что `@emotion/react` может остаться.

#### 2) Новый Provider слой (замена ChakraProvider)

Файлы:

- заменить `web/src/ui/chakra-core-ui/provider.tsx` на Mantine-аналог (или создать новый файл, например `web/src/ui/mantine/provider.tsx`).
- обновить `web/src/main.tsx` — вместо Chakra `Provider` подключить Mantine provider.

Что должно быть в Mantine provider:

- `<MantineProvider theme={...} defaultColorScheme=...>` (или color scheme через manager)
- `<ModalsProvider>` (если используем `@mantine/modals`)
- `<Notifications />` (если используем `@mantine/notifications`)

Color scheme (dark/light): 2 рабочих варианта

- **Вариант 2.1 (минимальные изменения)**: оставить `next-themes` как “источник истины”, а Mantine подключить к нему (bridge).
  - Плюс: вы уже это используете (`web/src/ui/chakra-core-ui/color-mode.tsx`), меньше переделок.
  - Минус: два слоя (next-themes + Mantine).
- **Вариант 2.2 (чистый Mantine)**: перейти на Mantine color scheme менеджмент.
  - Плюс: меньше зависимостей/связок.
  - Минус: нужно переписать текущий `ColorModeButton`/хуки и убедиться, что классы/атрибуты на `<html>`/`<body>` корректны.

#### 3) Уведомления (toasts)

Сейчас:

- `web/src/ui/chakra-core-ui/toaster.tsx`
- `web/src/App.tsx` рендерит `<Toaster />`

На Mantine:

- внедрить `@mantine/notifications`:
  - Provider/рендер компонента Notifications обычно ставится один раз (в provider-слое).
- заменить места, где будет показ тоста (сейчас это, похоже, централизовано — `useToast` в коде не найден, но есть кастомный toaster).

Результат:

- удалить/не использовать `web/src/ui/chakra-core-ui/toaster.tsx`
- обновить `web/src/App.tsx` (убрать `<Toaster />`)

#### 4) Оверлеи: Dialog/Drawer/Popover/Menu/Select (самая “болезненная” часть)

Сейчас:

- есть Chakra v3 compound-оверлеи в `web/src/ui/chakra-core-ui/*` + врапперы `web/src/ui/dialog.tsx` и `web/src/ui/drawer.tsx`
- есть “костыль слойности” через `persistentElements`

На Mantine:

- **Dialog**: `Modal` / `Dialog` (в Mantine это обычно `Modal` или `Drawer` компоненты из core).
- **Drawer**: `Drawer` из Mantine.
- **Popover/Menu/Tooltip**: соответствующие компоненты Mantine.
- **Select/Combobox**: Mantine `Select`, `MultiSelect`, `Combobox`/`Autocomplete` (в зависимости от кейса).

Что нужно сделать в коде:

- Переписать `web/src/ui/dialog.tsx` и `web/src/ui/drawer.tsx` в Mantine-обёртки, чтобы:
  - сохранить единый API проекта (например, `open/onOpenChange`, `title`, `size`, `footer`)
  - централизовать zIndex/portal-настройки (аналог того, что сейчас делается через `persistentElements`)

Проверки, которые обязательны после каждого шага:

- Select/Popover/Menu открываются **поверх** Dialog/Drawer и кликаются.
- Клик “вне” закрывает только то, что нужно (не закрывает “родителя” раньше “ребёнка”).
- ESC закрывает корректно (и только верхний слой).

#### 5) Layout-примитивы и базовые компоненты

Сейчас по проекту активно используются Chakra-примитивы:

- `Box`, `Flex`, `HStack`, `VStack`, `Stack`, `Text`, `Heading`, `Button`, `IconButton`, `Tabs`, и т.д.

На Mantine это обычно маппится так:

- Chakra `Box` → Mantine `Box`
- Chakra `Flex` → Mantine `Flex`
- Chakra `HStack/VStack/Stack` → Mantine `Group` / `Stack` (и иногда `Flex`)
- Chakra `Text` → Mantine `Text`
- Chakra `Heading` → Mantine `Title`
- Chakra `Button` → Mantine `Button`
- Chakra `IconButton` → Mantine `ActionIcon`
- Chakra `Tabs` → Mantine `Tabs`

Где менять:

- `web/src/App.tsx`
- `web/src/features/**/*`
- `web/src/ui/*` (включая `ui/form-components/*`)

#### 6) Формы (react-hook-form)

Сейчас:

- `web/src/ui/form-components/*` — врапперы под Chakra + RHF (`FormInput`, `FormSelect`, `FormTextarea`, и т.д.)

План миграции:

- Сохранить RHF, переписать внутренности на Mantine компоненты:
  - `Input` → `TextInput`
  - `Textarea` → `Textarea`
  - `Switch` → `Switch`
  - `Checkbox` → `Checkbox`
  - `Radio` → `Radio`/`Radio.Group`
  - `Select` → `Select`/`MultiSelect`/`Combobox` (по месту)
- Полностью заменить зависимость этих врапперов от `@ui/chakra-core-ui/field` (и `@chakra-ui/react Field`) на Mantine `InputWrapper` / `Fieldset` / `Text` (в зависимости от требуемого UX).

Затронутые файлы:

- `web/src/ui/form-components/form-input.tsx`
- `web/src/ui/form-components/form-textarea.tsx`
- `web/src/ui/form-components/form-select.tsx`
- `web/src/ui/form-components/form-checkbox.tsx`
- `web/src/ui/form-components/form-switch.tsx`
- `web/src/ui/form-components/form-radio.tsx`
- `web/src/ui/form-components/components/textarea-fullscreen-dialog.tsx` (оверлей)

#### 7) Иконки/tooltip-кнопки/мелкие врапперы

Сейчас:

- `web/src/ui/icon-button-with-tooltip.tsx` = Chakra `IconButton` + Chakra `Tooltip`

На Mantine:

- ActionIcon + Tooltip.
  - Это хороший кандидат на раннюю миграцию, чтобы выровнять UX во всём приложении.

#### 8) `ui/chakra-core-ui/*`: что с ними делать

Эта папка — в основном cli-snippets/обёртки Chakra v3. С учётом требования “мне всё равно на старые файлы”:

- На период миграции можно **оставить**, но постепенно перестать импортить.
- В конце миграции удалить целиком, кроме тех частей, которые ещё используются.

Критично: сейчас “костыли слойности” живут не только тут, а и в:

- `web/src/ui/dialog.tsx`
- `web/src/ui/drawer.tsx`

Их Mantine-аналоги должны закрыть те же проблемы (zIndex/порталы/stacking), иначе регресс повторится.

---

### Предлагаемый порядок миграции (по директориям)

1) Инфраструктура:
   - Provider + theme + notifications + (опционально) modals
   - правка `web/src/main.tsx`
2) “Остров” настроек (много форм/селектов):
   - `web/src/features/sidebars/settings/*`
   - `web/src/ui/form-components/*`
3) Остальные сайдбары:
   - `web/src/features/sidebars/*`
4) Чат-окно:
   - `web/src/features/chat-window/*`
5) Финальная чистка:
   - вынос/удаление `ui/chakra-core-ui/*`
   - удаление Chakra из зависимостей (если не осталось использования)

---

### Риски и “подводные камни”

- **Слойность/оверлеи** (ваша боль) — главный риск. Нельзя просто заменить `Dialog`/`Drawer` на Mantine без настройки portal/zIndex и без проверки вложенных popover/select/menu.
- **Стили/тема**: может потребоваться привести `web/src/index.css` к новому baseline (Mantine обычно сам делает reset/normalize в зависимости от настроек).
- **Смешивание Chakra и Mantine** временно возможно, но:
  - осторожно с CSS reset’ами
  - осторожно с оверлеями (две разные системы порталов/фокуса)

---

### Чек-лист проверки после миграции (ручной)

- **Sidebar Drawer**:
  - открыть/закрыть
  - проверить fullscreen режим сайдбара
- **Dialog**:
  - открыть “Edit chat modal”
  - открыть “Token manager”
  - внутри модалки открыть Select/Menu/Popover (если есть) — убедиться, что они поверх и кликаются
- **Forms**:
  - ввод текста, валидация/ошибки, disabled состояния
- **Dark/Light**:
  - переключение темы (если есть UI)
  - корректные цвета текста/фона
- **Notifications**:
  - показать success/error/loading (если используется)

---

### Грубая оценка объёма

По текущему состоянию кода:

- Chakra используется как минимум в ~68 файлах `web/src`.
- Самая дорогая часть — переписывание `ui/form-components/*` и всего, что завязано на overlay-компоненты.

Инкрементальная миграция “островами” обычно даёт лучший результат по риску/скорости, чем big-bang.

