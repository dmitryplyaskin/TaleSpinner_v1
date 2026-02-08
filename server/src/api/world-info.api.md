# World Info API (v1)

Base: `/api/world-info`

## Books

- `GET /books?ownerId&query&limit&before`
  - Returns: `{ data: { items: WorldInfoBookSummaryDto[], nextCursor: number | null } }`
- `POST /books`
  - Body: `{ ownerId?, name, slug?, description?, data?, extensions? }`
  - Returns: `{ data: WorldInfoBookDto }`
- `GET /books/:id`
  - Returns: `{ data: WorldInfoBookDto }`
- `PUT /books/:id`
  - Body: `{ ownerId?, name?, slug?, description?, data?, extensions?, version? }`
  - Returns: `{ data: WorldInfoBookDto }`
  - `409 CONFLICT` on optimistic-lock mismatch (`version`)
- `DELETE /books/:id`
  - Soft-delete
  - Returns: `{ data: { id } }`
- `POST /books/:id/duplicate`
  - Body: `{ ownerId?, name?, slug? }`
  - Returns: `{ data: WorldInfoBookDto }`

## Import/Export

- `POST /books/import`
  - `multipart/form-data`
  - Fields:
    - `file` (required, `.json` or `.png`)
    - `ownerId?`
    - `format?`: `auto | st_native | character_book | agnai | risu | novel`
  - Returns: `{ data: { book: WorldInfoBookDto, warnings: string[] } }`
- `GET /books/:id/export?format=st_native`
  - Returns ST-compatible JSON payload in envelope: `{ data: {...} }`

## Settings

- `GET /settings?ownerId`
  - Returns: `{ data: WorldInfoSettingsDto }`
- `PUT /settings`
  - Body: partial patch of settings fields (+ optional `ownerId`)
  - Returns: `{ data: WorldInfoSettingsDto }`

## Bindings

- `GET /bindings?ownerId&scope&scopeId`
  - Returns: `{ data: WorldInfoBindingDto[] }`
- `PUT /bindings`
  - Replace-all semantics for selected scope
  - Body:

```json
{
  "ownerId": "global",
  "scope": "chat",
  "scopeId": "chat-uuid",
  "items": [
    {
      "bookId": "book-uuid",
      "bindingRole": "additional",
      "displayOrder": 0,
      "enabled": true
    }
  ]
}
```

## Runtime Resolve

- `POST /resolve`
  - Body:
    - `chatId` (required)
    - `ownerId?`
    - `branchId?`
    - `entityProfileId?`
    - `trigger?` (`generate | regenerate`, default `generate`)
    - `historyLimit?` (`1..200`, default `50`)
    - `dryRun?` (default `true`)
  - Returns runtime result with:
    - `activatedEntries`
    - `worldInfoBefore`, `worldInfoAfter`
    - `depthEntries`, `outletEntries`
    - `debug`

## Validation limits

- Max raw book payload: `MAX_WORLD_INFO_BOOK_BYTES`
- Max entries per book: `MAX_WORLD_INFO_ENTRIES_PER_BOOK`
- Max chars per entry content: `MAX_WORLD_INFO_ENTRY_CONTENT_CHARS`

## Typical errors

- `400 VALIDATION_ERROR` - invalid payload / missing scopeId for non-global scope / missing books in bindings
- `404 NOT_FOUND` - unknown chat/book
- `409 CONFLICT` - optimistic-lock version mismatch on book update
