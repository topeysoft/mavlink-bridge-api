# Internationalization (i18n) Guide

## Overview

The YardRover application uses **vue-i18n** for internationalization with automatic mode-aware locale switching. This system provides:

- ✅ Centralized branding (change "YardRover" name in one place)
- ✅ Mode-specific language (Consumer vs Technical vs Developer)
- ✅ Foundation for future translations (Spanish, French, etc.)
- ✅ Type-safe translation keys

## Quick Start

### Using i18n in Components

```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <h1>{{ t('brand.name') }}</h1>
  <p>{{ t('auth.login.title') }}</p>
  <button>{{ t('common.actions.save') }}</button>
</template>
```

### Available Translation Keys

All translation keys are type-safe and defined in `src/i18n/types.ts`. Main categories:

- **`brand.*`** - Product name, tagline, company info
- **`nav.*`** - Navigation labels (automatically change based on mode)
- **`auth.*`** - Authentication and security strings
- **`common.*`** - Common actions, status messages, validation
- **`features.*`** - Feature names and descriptions
- **`modes.*`** - User mode labels and descriptions
- **`onboarding.*`** - Onboarding wizard text

### Mode-Aware Translations

The system automatically switches between three locales based on user mode:

| User Mode | Locale | Example: Missions |
|-----------|--------|-------------------|
| Consumer | `en-consumer` | "📋 My Jobs" |
| Power User | `en-technical` | "Missions" |
| Developer | `en-developer` | "Missions" |

**The locale switches automatically when the user changes their mode** - no code changes needed!

## Changing Product Branding

To rebrand the entire application, edit **one file**:

### `src/config/product.ts`

```typescript
export const PRODUCT_CONFIG: ProductConfig = {
  name: 'YourBrandName',           // Was: YardRover
  shortName: 'YBN',                // Was: YR
  tagline: 'Your Custom Tagline',  // Was: Your Autonomous Yard Assistant
  description: 'Product description',
  company: 'Your Company',
  supportEmail: 'support@yourbrand.com',
  docsUrl: 'https://docs.yourbrand.com',
  websiteUrl: 'https://yourbrand.com',
  githubUrl: 'https://github.com/yourorg/yourbrand',
  versionPrefix: 'v',
}
```

All references throughout the app will automatically update!

## Locale Files

Locale files are in `src/i18n/locales/`:

- **`en-consumer.ts`** - Friendly, emoji-rich language for everyday users
- **`en-technical.ts`** - Professional language for power users
- **`en-developer.ts`** - Technical language with developer terminology

### Adding New Translations

1. Add the key to `src/i18n/types.ts` in the `MessageSchema` interface
2. Add translations to all three locale files (`en-consumer.ts`, `en-technical.ts`, `en-developer.ts`)
3. Use the key in your components: `{{ t('your.new.key') }}`

Example:

```typescript
// src/i18n/types.ts
export interface MessageSchema {
  // ... existing keys
  myFeature: {
    title: string
    description: string
  }
}

// src/i18n/locales/en-consumer.ts
export default {
  // ... existing translations
  myFeature: {
    title: '🎉 My Cool Feature',
    description: 'This is super easy to use!'
  }
}

// src/i18n/locales/en-technical.ts
export default {
  // ... existing translations
  myFeature: {
    title: 'Advanced Feature',
    description: 'Professional feature description'
  }
}
```

## Adding New Languages

To add a new language (e.g., Spanish):

1. Create `src/i18n/locales/es-consumer.ts`, `es-technical.ts`, `es-developer.ts`
2. Copy the structure from English locales
3. Translate all strings
4. Update `src/i18n/types.ts` to add new `SupportedLocale` values
5. Update `src/i18n/index.ts` to import and register the new locales
6. Add language selector UI (future feature)

## Using i18n Outside Components

For use in non-component files (stores, utils, etc.):

```typescript
import { t } from '@/i18n'

const message = t('common.actions.save')
```

## Migration Status

The following components have been migrated to use i18n:

- ✅ `Sidebar.vue` - Navigation labels
- ✅ `LoginPage.vue` - Auth page strings
- ✅ `SetupWizard.vue` - Onboarding imports
- ✅ `main.ts` - i18n plugin registered
- ✅ `features.ts` - Automatic locale switching

### To Migrate Remaining Components

Search for hard-coded strings:
```bash
# Find "YardRover" references
grep -r "YardRover" app/src --include="*.vue" --include="*.ts"

# Find hard-coded navigation labels
grep -r "Missions\|Dashboard\|Settings" app/src --include="*.vue"
```

Replace with i18n keys:
```vue
<!-- Before -->
<h1>YardRover</h1>
<button>Save</button>

<!-- After -->
<h1>{{ t('brand.name') }}</h1>
<button>{{ t('common.actions.save') }}</button>
```

## Best Practices

1. **Always use i18n keys** - Never hard-code user-facing strings
2. **Use semantic keys** - `auth.login.title` not `loginTitle`
3. **Brand references** - Use `t('brand.name')` instead of "YardRover"
4. **Mode-aware content** - Let the locale files handle mode-specific language
5. **Add emojis in consumer mode only** - Technical/developer modes should be professional

## Files Overview

```
app/src/
├── config/
│   └── product.ts                    # ⭐ Product branding config
├── i18n/
│   ├── index.ts                      # i18n setup and configuration
│   ├── types.ts                      # Type definitions
│   └── locales/
│       ├── en-consumer.ts            # Consumer-friendly English
│       ├── en-technical.ts           # Technical English
│       └── en-developer.ts           # Developer English
├── stores/
│   └── features.ts                   # Auto-switches locale on mode change
└── main.ts                           # Registers i18n plugin
```

## LocalStorage Keys

The system uses the following localStorage keys (defined in `product.ts`):

- `yardrover_user_mode` - Current user mode (consumer/power-user/developer)
- `yardrover_feature_flags` - Custom feature flags
- `yardrover_use_custom_flags` - Whether custom flags are enabled

These keys automatically use the product name prefix, so rebranding won't break stored data.

## Future Enhancements

Potential improvements:

- [ ] Language selector dropdown in settings
- [ ] RTL (right-to-left) language support
- [ ] Pluralization rules for count-based translations
- [ ] Date/time formatting per locale
- [ ] Number formatting (currency, percentages)
- [ ] Translation coverage testing
- [ ] Crowdin/Lokalise integration for collaborative translation

## Troubleshooting

**Issue**: Translation key not found
- Check that the key exists in all three locale files
- Verify the key is added to `MessageSchema` in `types.ts`

**Issue**: Mode change doesn't update language
- Ensure `switchLocale()` is called in `features.ts` `setUserMode()`
- Check browser console for i18n warnings

**Issue**: TypeScript errors for translation keys
- Run `npm run type-check` to verify type definitions
- Ensure all locale files match the `MessageSchema` interface

## Support

For questions or issues with i18n:
- See main project documentation in `/CLAUDE.md`
- Check vue-i18n docs: https://vue-i18n.intlify.dev/
