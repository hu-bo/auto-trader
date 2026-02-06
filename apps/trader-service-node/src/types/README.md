# Types Directory

This directory contains TypeScript type definitions for the application.

## Configuration Types (`config.ts`)

Configuration types define the structure of application configuration objects. These types are used with MidwayJS's `@Config` decorator to inject configuration with proper type safety.

### Usage Example

```typescript
import { Config, Provide } from '@midwayjs/core';
import type { CasdoorConfig, AuthConfig } from '../types/index.js';

@Provide()
export class MyService {
  @Config('auth')
  authConfig!: AuthConfig;

  @Config('casdoor')
  casdoorConfig!: CasdoorConfig;

  someMethod() {
    // Access config with full type safety
    const mode = this.authConfig.mode;
    const endpoint = this.casdoorConfig.endpoint;
  }
}
```

### Benefits

1. **Type Safety**: Full TypeScript type checking for configuration access
2. **Centralized**: All configuration types in one place
3. **Maintainable**: Easy to update when configuration structure changes
4. **Documentation**: Types serve as documentation for configuration structure

### Configuration Sections

- `AuthConfig`: Authentication mode configuration
- `CasdoorConfig`: Casdoor SSO integration settings
- `EncryptionConfig`: Encryption key configuration
- `ExchangeGrpcConfig`: Exchange gRPC service connection settings
- `AppConfig`: Complete application configuration interface
