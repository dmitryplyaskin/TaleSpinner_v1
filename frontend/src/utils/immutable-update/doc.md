````markdown
# Immutable Data Helper Documentation

A TypeScript utility function for performing immutable updates on complex nested data structures while maintaining type safety.

## Features

- 🛡️ **Immutable Updates**: Always returns new objects/arrays
- 🧭 **Deep Path Navigation**: Handle nested structures with ease
- 🔍 **Custom Search Criteria**: Find elements in arrays by any field(s)
- 🛠️ **Flexible Updaters**: Use direct values or transformation functions
- ⚙️ **Array Operations**: Filter, append, prepend, merge, bulk update
- 🔄 **Upsert Support**: Update existing or insert new elements
- 🦺 **Type Safety**: Full TypeScript type checking

## Installation

```bash
# Required peer dependency
npm install typescript
```
````

Copy the function code into your project (recommended location: `src/utils/immutable-helper.ts`)

## Basic Usage

```typescript
import { updateImmutable } from './utils/immutable-helper';

// Sample interface
interface User {
	id: string;
	name: string;
	contacts: Array<{
		type: string;
		value: string;
	}>;
}

// Example object
const user: User = {
	id: 'user-123',
	name: 'John Doe',
	contacts: [
		{ type: 'email', value: 'john@doe.com' },
		{ type: 'phone', value: '+123456789' },
	],
};

// Update name directly
const updatedUser = updateImmutable(user, ['name'], 'Jane Smith');

// Update nested contact
const withUpdatedEmail = updateImmutable(user, ['contacts', { find: ['type', 'email'] }, 'value'], 'jane@smith.com');
```

## Path Syntax

### Object Navigation

```typescript
// Simple property access
['propertyName'][
	// Nested objects
	('outerProp', 'innerProp', 'deepProp')
];
```

### Array Navigation

```typescript
// Find by ID
['arrayProp', { find: ['id', 'item-123'] }][
	// Find by multiple criteria
	('items', { find: { status: 'active', priority: 'high' } })
][
	// Nested arrays
	('groups', { find: ['groupId', 'A'] }, 'members', { find: ['role', 'admin'] })
];
```

## Updater Argument

### Direct Value

```typescript
// Set primitive value
updateImmutable(data, ['profile', 'age'], 30);

// Replace object
updateImmutable(data, ['settings'], newSettings);
```

### Function Transformer

```typescript
// Complex transformation
updateImmutable(data, ['statistics'], (currentStats) => ({
	...currentStats,
	total: currentStats.views + currentStats.clicks,
	updatedAt: Date.now(),
}));
```

## Array Operations

### Available Operations

| Operation    | Description                   | Example                                               |
| ------------ | ----------------------------- | ----------------------------------------------------- |
| `$filter`    | Filter array elements         | `{ $filter: (item) => item.active }`                  |
| `$append`    | Add items to end              | `{ $append: newItem }`                                |
| `$prepend`   | Add items to beginning        | `{ $prepend: [item1, item2] }`                        |
| `$merge`     | Merge with another array      | `{ $merge: additionalItems }`                         |
| `$updateAll` | Transform all elements        | `{ $updateAll: (item) => ({ ...item, read: true }) }` |
| `$upsert`    | Update existing or insert new | `{ $upsert: (item) => [found, newItem] }`             |

### Operation Examples

**Filter Active Items**

```typescript
updateImmutable(data, ['notifications'], {
	$filter: (note) => note.unread,
});
```

**Bulk Update**

```typescript
updateImmutable(data, ['posts'], {
	$updateAll: (post) => ({
		...post,
		metadata: { ...post.metadata, archived: true },
	}),
});
```

**Upsert Pattern**

```typescript
updateImmutable(data, ['comments'], {
	$upsert: (comment) => [
		comment?.id === 'new-comment',
		comment?.id === 'new-comment' ? { ...comment, text: 'Updated' } : { id: 'new-comment', text: 'New comment' },
	],
});
```

## Custom Search Criteria

### Single Field Search

```typescript
['items', { find: ['email', 'user@domain.com'] }, 'preferences'];
```

### Multi-field Search

```typescript
['orders', { find: { status: 'pending', region: 'EU' } }, 'products'];
```

### Index-based Access (Special Case)

```typescript
['logEntries', { find: ['_index', 0] }]; // First element
```

## Type Safety

The function provides compile-time checks for:

- Valid path segments
- Correct value types
- Proper operation structures
- Array element shapes

**Note**: Type inference works best when using interface/type definitions consistently.

## Best Practices

1. **Use Stable IDs**: Ensure array elements have unique identifiers
2. **Prefer Shallow Paths**: Minimize nesting depth when possible
3. **Pure Functions**: Keep updater functions side-effect free
4. **Performance Care**: For large arrays (>1000 items), consider optimizations
5. **Test Complex Operations**: Verify upsert/filter logic with unit tests

## Troubleshooting

**Element Not Found**  
Verify:

- Correct path structure
- Matching ID values
- Existing elements in array

**Type Errors**  
Check:

- Interface definitions
- Operation return types
- Array shape consistency

**Performance Issues**  
Consider:

- Using smaller payloads
- Alternative data structures
- Memoization techniques

---

**License**: MIT  
**Maintainer**: Your Engineering Team  
**Version**: 1.2.0

```

Let me know if you need any clarification or additional sections!
```
