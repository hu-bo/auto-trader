# User Service - 用户 & 配置管理服务

## 概述

用户服务是量化交易系统的用户管理层，负责：
- 用户身份认证与授权
- 用户配置管理
- 策略配置管理
- API 密钥管理
- 通知设置管理
- 用户偏好设置

## 技术栈

- **语言**: Node.js 20+
- **框架**: NestJS + TypeScript
- **数据库**: PostgreSQL (用户数据), Redis (会话/缓存)
- **认证**: JWT + OAuth2
- **加密**: bcrypt, crypto
- **容器**: Docker + Docker Compose
- **邮件**: Nodemailer + SendGrid

## 架构设计

### 1. 核心组件

```
user-service/
├── src/
│   ├── api/                    # REST API 层
│   │   ├── v1/
│   │   │   ├── auth.controller.ts      # 认证
│   │   │   ├── users.controller.ts     # 用户管理
│   │   │   ├── configs.controller.ts   # 配置管理
│   │   │   ├── api-keys.controller.ts  # API 密钥
│   │   │   └── notifications.controller.ts  # 通知
│   │   └── dto/                # DTO 定义
│   ├── core/                   # 核心逻辑
│   │   ├── auth/               # 认证模块
│   │   │   ├── jwt.strategy.ts
│   │   │   ├── oauth.strategy.ts
│   │   │   └── guard/
│   │   ├── user/               # 用户模块
│   │   │   ├── user.service.ts
│   │   │   ├── user.repository.ts
│   │   │   └── user.validator.ts
│   │   ├── config/             # 配置模块
│   │   │   ├── config.service.ts
│   │   │   ├── config.repository.ts
│   │   │   └── config.validator.ts
│   │   └── api-key/           # API 密钥模块
│   │       ├── api-key.service.ts
│   │       ├── api-key.repository.ts
│   │       └── api-key.generator.ts
│   ├── entities/               # 数据实体
│   │   ├── user.entity.ts
│   │   ├── config.entity.ts
│   │   ├── api-key.entity.ts
│   │   ├── notification.entity.ts
│   │   └── preference.entity.ts
│   ├── services/               # 业务服务
│   │   ├── auth.service.ts
│   │   ├── user.service.ts
│   │   ├── config.service.ts
│   │   ├── api-key.service.ts
│   │   ├── notification.service.ts
│   │   └── email.service.ts
│   ├── subscribers/            # 事件订阅
│   │   ├── user.subscriber.ts
│   │   └── config.subscriber.ts
│   ├── tasks/                  # 定时任务
│   │   ├── cleanup-tasks.ts
│   │   └── notification-tasks.ts
│   └── utils/                  # 工具类
│       ├── logger.ts
│       ├── config.ts
│       ├── validator.ts
│       ├── crypto.ts
│       └── email.ts
├── tests/                      # 测试
├── config/                     # 配置文件
├── scripts/                    # 脚本
├── Dockerfile
├── docker-compose.yml
├── package.json
└── tsconfig.json
```

### 2. 数据模型

#### 用户实体
```typescript
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password_hash: string;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @Column({ default: false })
  email_verified: boolean;

  @Column({ default: false })
  phone_verified: boolean;

  @Column({ type: 'jsonb', default: '{}' })
  preferences: Record<string, any>;

  @Column({ type: 'timestamp', nullable: true })
  last_login: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @OneToMany(() => ApiKey, (apiKey) => apiKey.user)
  api_keys: ApiKey[];

  @OneToMany(() => UserConfig, (config) => config.user)
  configs: UserConfig[];

  @OneToMany(() => Notification, (notification) => notification.user)
  notifications: Notification[];
}
```

#### 配置实体
```typescript
@Entity('user_configs')
export class UserConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @Column()
  name: string;

  @Column({ type: 'jsonb' })
  config: Record<string, any>;

  @Column({ type: 'enum', enum: ConfigType })
  type: ConfigType;

  @Column({ nullable: true })
  description: string;

  @Column({ default: true })
  is_active: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @ManyToOne(() => User, (user) => user.configs)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
```

#### API 密钥实体
```typescript
@Entity('api_keys')
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @Column({ unique: true })
  key: string;

  @Column()
  secret_hash: string;

  @Column({ nullable: true })
  name: string;

  @Column({ type: 'jsonb', default: '{}' })
  permissions: Record<string, boolean>;

  @Column({ type: 'timestamp', nullable: true })
  expires_at: Date;

  @Column({ default: true })
  is_active: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @ManyToOne(() => User, (user) => user.api_keys)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
```

## 认证与授权

### 1. JWT 认证流程

```
用户登录 → 验证凭证 → 生成 JWT → 返回 Token → 后续请求携带 Token → 验证 Token → 授权访问
```

### 2. JWT 策略

```typescript
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly userService: UserService,
    private readonly configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    const user = await this.userService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('用户状态异常');
    }

    return user;
  }
}
```

### 3. OAuth2 支持

```typescript
@Injectable()
export class OAuthStrategy extends PassportStrategy(Strategy, 'oauth') {
  constructor(
    private readonly userService: UserService,
    private readonly configService: ConfigService,
  ) {
    super({
      clientID: configService.get('OAUTH_CLIENT_ID'),
      clientSecret: configService.get('OAUTH_CLIENT_SECRET'),
      callbackURL: configService.get('OAUTH_CALLBACK_URL'),
      scope: ['profile', 'email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
  ): Promise<User> {
    const email = profile.emails[0].value;

    let user = await this.userService.findByEmail(email);

    if (!user) {
      // 创建新用户
      user = await this.userService.create({
        email,
        name: profile.displayName,
        password: '', // OAuth 用户不需要密码
        provider: profile.provider,
        provider_id: profile.id,
      });
    }

    return user;
  }
}
```

### 4. 权限控制

```typescript
// 权限枚举
export enum Permission {
  // 用户权限
  USER_READ = 'user:read',
  USER_WRITE = 'user:write',
  USER_DELETE = 'user:delete',

  // 配置权限
  CONFIG_READ = 'config:read',
  CONFIG_WRITE = 'config:write',
  CONFIG_DELETE = 'config:delete',

  // API 密钥权限
  API_KEY_READ = 'api_key:read',
  API_KEY_WRITE = 'api_key:write',
  API_KEY_DELETE = 'api_key:delete',

  // 通知权限
  NOTIFICATION_READ = 'notification:read',
  NOTIFICATION_WRITE = 'notification:write',
  NOTIFICATION_DELETE = 'notification:delete',

  // 策略权限
  STRATEGY_READ = 'strategy:read',
  STRATEGY_WRITE = 'strategy:write',
  STRATEGY_DELETE = 'strategy:delete',

  // 交易权限
  TRADE_READ = 'trade:read',
  TRADE_WRITE = 'trade:write',
  TRADE_DELETE = 'trade:delete',
}

// 角色权限映射
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    Permission.USER_READ, Permission.USER_WRITE, Permission.USER_DELETE,
    Permission.CONFIG_READ, Permission.CONFIG_WRITE, Permission.CONFIG_DELETE,
    Permission.API_KEY_READ, Permission.API_KEY_WRITE, Permission.API_KEY_DELETE,
    Permission.NOTIFICATION_READ, Permission.NOTIFICATION_WRITE, Permission.NOTIFICATION_DELETE,
    Permission.STRATEGY_READ, Permission.STRATEGY_WRITE, Permission.STRATEGY_DELETE,
    Permission.TRADE_READ, Permission.TRADE_WRITE, Permission.TRADE_DELETE,
  ],
  [UserRole.USER]: [
    Permission.USER_READ, Permission.USER_WRITE,
    Permission.CONFIG_READ, Permission.CONFIG_WRITE,
    Permission.API_KEY_READ, Permission.API_KEY_WRITE,
    Permission.NOTIFICATION_READ, Permission.NOTIFICATION_WRITE,
    Permission.STRATEGY_READ, Permission.STRATEGY_WRITE,
    Permission.TRADE_READ, Permission.TRADE_WRITE,
  ],
  [UserRole.VIEWER]: [
    Permission.USER_READ,
    Permission.CONFIG_READ,
    Permission.API_KEY_READ,
    Permission.NOTIFICATION_READ,
    Permission.STRATEGY_READ,
    Permission.TRADE_READ,
  ],
};
```

## API 接口

### 1. 认证 API

#### POST /api/v1/auth/register
用户注册

**请求示例**:
```json
{
  "email": "user@example.com",
  "password": "StrongPass123!",
  "name": "张三",
  "phone": "+8613800138000"
}
```

**响应示例**:
```json
{
  "id": "user_001",
  "email": "user@example.com",
  "name": "张三",
  "role": "user",
  "status": "active",
  "email_verified": false,
  "created_at": "2026-01-22T10:00:00Z"
}
```

#### POST /api/v1/auth/login
用户登录

**请求示例**:
```json
{
  "email": "user@example.com",
  "password": "StrongPass123!"
}
```

**响应示例**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "user": {
    "id": "user_001",
    "email": "user@example.com",
    "name": "张三",
    "role": "user"
  }
}
```

#### POST /api/v1/auth/refresh
刷新 Token

**请求示例**:
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### POST /api/v1/auth/logout
用户登出

#### POST /api/v1/auth/reset-password
重置密码

**请求示例**:
```json
{
  "email": "user@example.com"
}
```

#### POST /api/v1/auth/verify-email
验证邮箱

**请求示例**:
```json
{
  "token": "email_verification_token"
}
```

### 2. 用户管理 API

#### GET /api/v1/users/me
获取当前用户信息

**响应示例**:
```json
{
  "id": "user_001",
  "email": "user@example.com",
  "name": "张三",
  "phone": "+8613800138000",
  "role": "user",
  "status": "active",
  "email_verified": true,
  "phone_verified": false,
  "preferences": {
    "language": "zh-CN",
    "timezone": "Asia/Shanghai",
    "theme": "dark"
  },
  "last_login": "2026-01-22T10:00:00Z",
  "created_at": "2026-01-22T10:00:00Z"
}
```

#### PUT /api/v1/users/me
更新当前用户信息

**请求示例**:
```json
{
  "name": "李四",
  "phone": "+8613800138001",
  "preferences": {
    "language": "en-US",
    "timezone": "UTC",
    "theme": "light"
  }
}
```

#### PUT /api/v1/users/me/password
修改密码

**请求示例**:
```json
{
  "current_password": "OldPass123!",
  "new_password": "NewPass456!"
}
```

#### GET /api/v1/users (Admin only)
获取用户列表

**查询参数**:
- `page`: 页码
- `limit`: 每页数量
- `role`: 角色过滤
- `status`: 状态过滤
- `email`: 邮箱搜索

**响应示例**:
```json
{
  "users": [
    {
      "id": "user_001",
      "email": "user@example.com",
      "name": "张三",
      "role": "user",
      "status": "active",
      "created_at": "2026-01-22T10:00:00Z"
    }
  ],
  "total": 1,
  "page": 0,
  "limit": 20
}
```

#### PUT /api/v1/users/{userId}/status (Admin only)
更新用户状态

**请求示例**:
```json
{
  "status": "suspended"
}
```

### 3. 配置管理 API

#### GET /api/v1/configs
获取配置列表

**查询参数**:
- `type`: 配置类型
- `is_active`: 是否激活
- `page`: 页码
- `limit`: 每页数量

**响应示例**:
```json
{
  "configs": [
    {
      "id": "config_001",
      "name": "趋势跟踪策略配置",
      "type": "strategy",
      "config": {
        "fast_period": 20,
        "slow_period": 50,
        "stop_loss_pct": 0.02,
        "take_profit_pct": 0.05
      },
      "description": "BTC/USDT 趋势跟踪策略",
      "is_active": true,
      "created_at": "2026-01-22T10:00:00Z",
      "updated_at": "2026-01-22T10:00:00Z"
    }
  ],
  "total": 1,
  "page": 0,
  "limit": 20
}
```

#### POST /api/v1/configs
创建配置

**请求示例**:
```json
{
  "name": "趋势跟踪策略配置",
  "type": "strategy",
  "config": {
    "fast_period": 20,
    "slow_period": 50,
    "stop_loss_pct": 0.02,
    "take_profit_pct": 0.05
  },
  "description": "BTC/USDT 趋势跟踪策略"
}
```

#### GET /api/v1/configs/{configId}
获取单个配置

#### PUT /api/v1/configs/{configId}
更新配置

#### DELETE /api/v1/configs/{configId}
删除配置

#### POST /api/v1/configs/{configId}/duplicate
复制配置

### 4. API 密钥管理 API

#### GET /api/v1/api-keys
获取 API 密钥列表

**响应示例**:
```json
{
  "api_keys": [
    {
      "id": "key_001",
      "key": "ak_abc123def456",
      "name": "交易引擎密钥",
      "permissions": {
        "trade:read": true,
        "trade:write": true,
        "strategy:read": true
      },
      "expires_at": "2026-12-31T23:59:59Z",
      "is_active": true,
      "created_at": "2026-01-22T10:00:00Z",
      "last_used": "2026-01-22T10:30:00Z"
    }
  ],
  "total": 1
}
```

#### POST /api/v1/api-keys
创建 API 密钥

**请求示例**:
```json
{
  "name": "交易引擎密钥",
  "permissions": {
    "trade:read": true,
    "trade:write": true,
    "strategy:read": true
  },
  "expires_in_days": 365
}
```

**响应示例**:
```json
{
  "id": "key_001",
  "key": "ak_abc123def456",
  "secret": "sk_xyz789uvw012",  // 仅显示一次
  "name": "交易引擎密钥",
  "permissions": {
    "trade:read": true,
    "trade:write": true,
    "strategy:read": true
  },
  "expires_at": "2026-12-31T23:59:59Z",
  "is_active": true,
  "created_at": "2026-01-22T10:00:00Z"
}
```

#### GET /api/v1/api-keys/{keyId}
获取单个 API 密钥

#### PUT /api/v1/api-keys/{keyId}
更新 API 密钥

#### DELETE /api/v1/api-keys/{keyId}
删除 API 密钥

#### POST /api/v1/api-keys/{keyId}/rotate
轮换 API 密钥

### 5. 通知设置 API

#### GET /api/v1/notifications/settings
获取通知设置

**响应示例**:
```json
{
  "email": {
    "order_filled": true,
    "order_rejected": true,
    "position_close": true,
    "risk_alert": true,
    "daily_report": true
  },
  "sms": {
    "order_filled": false,
    "risk_alert": true
  },
  "webhook": {
    "enabled": false,
    "url": ""
  }
}
```

#### PUT /api/v1/notifications/settings
更新通知设置

**请求示例**:
```json
{
  "email": {
    "order_filled": true,
    "order_rejected": true,
    "position_close": true,
    "risk_alert": true,
    "daily_report": true
  },
  "sms": {
    "order_filled": false,
    "risk_alert": true
  }
}
```

#### GET /api/v1/notifications/history
获取通知历史

**查询参数**:
- `type`: 通知类型
- `start_time`: 开始时间
- `end_time`: 结束时间
- `page`: 页码
- `limit`: 每页数量

## 数据库设计

### 1. 用户表 (users)

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100),
  phone VARCHAR(20),
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  email_verified BOOLEAN DEFAULT FALSE,
  phone_verified BOOLEAN DEFAULT FALSE,
  preferences JSONB DEFAULT '{}',
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  INDEX idx_email (email),
  INDEX idx_role (role),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);
```

### 2. 用户配置表 (user_configs)

```sql
CREATE TABLE user_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  config JSONB NOT NULL,
  type VARCHAR(50) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_type (type),
  INDEX idx_is_active (is_active)
);
```

### 3. API 密钥表 (api_keys)

```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  key VARCHAR(64) UNIQUE NOT NULL,
  secret_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  permissions JSONB NOT NULL DEFAULT '{}',
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used TIMESTAMP WITH TIME ZONE,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_key (key),
  INDEX idx_is_active (is_active)
);
```

### 4. 通知设置表 (notification_settings)

```sql
CREATE TABLE notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  channel VARCHAR(20) NOT NULL,
  events JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_channel (channel)
);
```

### 5. 通知历史表 (notification_history)

```sql
CREATE TABLE notification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  channel VARCHAR(20) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  status VARCHAR(20) NOT NULL,
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_channel (channel),
  INDEX idx_event_type (event_type),
  INDEX idx_sent_at (sent_at)
);
```

## 配置管理

### 1. 环境配置

```yaml
# config/config.yaml
app:
  name: "user-service"
  env: "production"
  debug: false
  port: 3001

database:
  postgres:
    host: "postgres"
    port: 5432
    database: "user_db"
    user: "user_user"
    password: "${DB_PASSWORD}"

redis:
  host: "redis"
  port: 6379
  db: 0

jwt:
  secret: "${JWT_SECRET}"
  access_token_expires_in: "1h"
  refresh_token_expires_in: "7d"

oauth:
  google:
    client_id: "${GOOGLE_CLIENT_ID}"
    client_secret: "${GOOGLE_CLIENT_SECRET}"
    callback_url: "${GOOGLE_CALLBACK_URL}"
  github:
    client_id: "${GITHUB_CLIENT_ID}"
    client_secret: "${GITHUB_CLIENT_SECRET}"
    callback_url: "${GITHUB_CALLBACK_URL}"

email:
  provider: "sendgrid"  # sendgrid, smtp
  sendgrid_api_key: "${SENDGRID_API_KEY}"
  from_email: "noreply@autotrader.com"
  from_name: "Auto Trader"
  smtp:
    host: "${SMTP_HOST}"
    port: 587
    user: "${SMTP_USER}"
    pass: "${SMTP_PASS}"

password:
  min_length: 8
  require_uppercase: true
  require_lowercase: true
  require_numbers: true
  require_special: true

rate_limit:
  login: 5  # 5次/分钟
  register: 3  # 3次/小时
  reset_password: 3  # 3次/小时

security:
  password_hash_rounds: 12
  api_key_length: 32
  api_secret_length: 64
  email_verification_token_expires_in: "24h"
  password_reset_token_expires_in: "1h"
```

### 2. 配置类型定义

```typescript
export enum ConfigType {
  STRATEGY = 'strategy',      // 策略配置
  RISK = 'risk',              // 风控配置
  TRADING = 'trading',        // 交易配置
  NOTIFICATION = 'notification', // 通知配置
  PREFERENCE = 'preference',  // 偏好配置
  CUSTOM = 'custom',          // 自定义配置
}
```

## 邮件服务

### 1. 邮件模板

```typescript
// templates/email-verification.html
export const emailVerificationTemplate = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .button { display: inline-block; padding: 12px 24px; background: #4CAF50; color: white; text-decoration: none; border-radius: 4px; }
    .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Auto Trader</h1>
    </div>
    <div class="content">
      <h2>验证您的邮箱</h2>
      <p>您好，${name}！</p>
      <p>请点击下方按钮验证您的邮箱地址：</p>
      <p><a href="${verificationUrl}" class="button">验证邮箱</a></p>
      <p>如果按钮无法点击，请复制以下链接到浏览器：</p>
      <p><code>${verificationUrl}</code></p>
      <p>此链接将在 24 小时后失效。</p>
    </div>
    <div class="footer">
      <p>© 2026 Auto Trader. All rights reserved.</p>
      <p>如果您没有注册此账户，请忽略此邮件。</p>
    </div>
  </div>
</body>
</html>
`;
```

### 2. 邮件发送服务

```typescript
@Injectable()
export class EmailService {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {}

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    const provider = this.configService.get('email.provider');

    if (provider === 'sendgrid') {
      await this.sendWithSendGrid(to, subject, html);
    } else if (provider === 'smtp') {
      await this.sendWithSMTP(to, subject, html);
    } else {
      throw new Error('Unsupported email provider');
    }
  }

  private async sendWithSendGrid(to: string, subject: string, html: string): Promise<void> {
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(this.configService.get('email.sendgrid_api_key'));

    const msg = {
      to,
      from: {
        email: this.configService.get('email.from_email'),
        name: this.configService.get('email.from_name'),
      },
      subject,
      html,
    };

    try {
      await sgMail.send(msg);
      this.logger.log(`Email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error);
      throw error;
    }
  }

  private async sendWithSMTP(to: string, subject: string, html: string): Promise<void> {
    const nodemailer = require('nodemailer');

    const transporter = nodemailer.createTransport({
      host: this.configService.get('email.smtp.host'),
      port: this.configService.get('email.smtp.port'),
      secure: false,
      auth: {
        user: this.configService.get('email.smtp.user'),
        pass: this.configService.get('email.smtp.pass'),
      },
    });

    const mailOptions = {
      from: `${this.configService.get('email.from_name')} <${this.configService.get('email.from_email')}>`,
      to,
      subject,
      html,
    };

    try {
      await transporter.sendMail(mailOptions);
      this.logger.log(`Email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error);
      throw error;
    }
  }

  async sendEmailVerification(user: User, token: string): Promise<void> {
    const verificationUrl = `${this.configService.get('app.url')}/verify-email?token=${token}`;
    const html = emailVerificationTemplate
      .replace('${name}', user.name || user.email)
      .replace('${verificationUrl}', verificationUrl)
      .replace('${verificationUrl}', verificationUrl);

    await this.sendEmail(user.email, '验证您的邮箱', html);
  }

  async sendPasswordReset(user: User, token: string): Promise<void> {
    const resetUrl = `${this.configService.get('app.url')}/reset-password?token=${token}`;
    const html = passwordResetTemplate
      .replace('${name}', user.name || user.email)
      .replace('${resetUrl}', resetUrl)
      .replace('${resetUrl}', resetUrl);

    await this.sendEmail(user.email, '重置您的密码', html);
  }

  async sendDailyReport(user: User, report: any): Promise<void> {
    const html = dailyReportTemplate
      .replace('${name}', user.name || user.email)
      .replace('${report}', JSON.stringify(report, null, 2));

    await this.sendEmail(user.email, '每日交易报告', html);
  }
}
```

## 部署

### 1. Docker 部署

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci --only=production

# 复制源代码
COPY . .

# 构建
RUN npm run build

# 暴露端口
EXPOSE 3001

# 启动
CMD ["node", "dist/main.js"]
```

### 2. Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  user-service:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DB_PASSWORD=${DB_PASSWORD}
      - JWT_SECRET=${JWT_SECRET}
      - SENDGRID_API_KEY=${SENDGRID_API_KEY}
    depends_on:
      - postgres
      - redis
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: user_db
      POSTGRES_USER: user_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

## 监控与日志

### 1. 日志配置

```typescript
// src/utils/logger.ts
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    // 错误日志
    new DailyRotateFile({
      filename: '/app/logs/user-error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '10m',
      maxFiles: '30d'
    }),
    // 信息日志
    new DailyRotateFile({
      filename: '/app/logs/user-info-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '10m',
      maxFiles: '30d'
    })
  ]
});

// 开发环境添加控制台输出
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

export default logger;
```

### 2. 指标监控

```typescript
// src/utils/metrics.ts
import promClient from 'prom-client';

export const metrics = {
  // 用户指标
  userRegistered: new promClient.Counter({
    name: 'user_registered_total',
    help: 'Total number of users registered',
    labelNames: ['provider']
  }),

  userLogin: new promClient.Counter({
    name: 'user_login_total',
    help: 'Total number of user logins',
    labelNames: ['provider']
  }),

  userActive: new promClient.Gauge({
    name: 'user_active',
    help: 'Number of active users'
  }),

  // 认证指标
  authSuccess: new promClient.Counter({
    name: 'auth_success_total',
    help: 'Total number of successful authentications',
    labelNames: ['provider']
  }),

  authFailure: new promClient.Counter({
    name: 'auth_failure_total',
    help: 'Total number of failed authentications',
    labelNames: ['provider', 'reason']
  }),

  // API 密钥指标
  apiKeyCreated: new promClient.Counter({
    name: 'api_key_created_total',
    help: 'Total number of API keys created'
  }),

  apiKeyUsed: new promClient.Counter({
    name: 'api_key_used_total',
    help: 'Total number of API key usages',
    labelNames: ['key_id']
  }),

  // 邮件指标
  emailSent: new promClient.Counter({
    name: 'email_sent_total',
    help: 'Total number of emails sent',
    labelNames: ['type', 'status']
  }),

  // 配置指标
  configCreated: new promClient.Counter({
    name: 'config_created_total',
    help: 'Total number of configs created',
    labelNames: ['type']
  }),

  configUpdated: new promClient.Counter({
    name: 'config_updated_total',
    help: 'Total number of configs updated',
    labelNames: ['type']
  })
};
```

## 测试

### 1. 单元测试

```bash
npm run test:unit
```

### 2. 集成测试

```bash
npm run test:integration
```

### 3. E2E 测试

```bash
npm run test:e2e
```

## 开发指南

### 1. 添加新配置类型

```typescript
// src/core/config/config.validator.ts
export const configSchemas: Record<ConfigType, any> = {
  [ConfigType.STRATEGY]: {
    type: 'object',
    properties: {
      fast_period: { type: 'number', minimum: 1 },
      slow_period: { type: 'number', minimum: 1 },
      stop_loss_pct: { type: 'number', minimum: 0, maximum: 1 },
      take_profit_pct: { type: 'number', minimum: 0, maximum: 1 },
    },
    required: ['fast_period', 'slow_period'],
  },
  [ConfigType.RISK]: {
    type: 'object',
    properties: {
      max_position_pct: { type: 'number', minimum: 0, maximum: 1 },
      max_daily_volume: { type: 'number', minimum: 0 },
      max_drawdown: { type: 'number', minimum: 0, maximum: 1 },
    },
    required: ['max_position_pct', 'max_daily_volume'],
  },
  // ... 其他配置类型
};
```

### 2. 添加新通知渠道

```typescript
// src/services/notification.service.ts
export enum NotificationChannel {
  EMAIL = 'email',
  SMS = 'sms',
  WEBHOOK = 'webhook',
  TELEGRAM = 'telegram',
}

@Injectable()
export class NotificationService {
  async send(channel: NotificationChannel, event: string, data: any): Promise<void> {
    switch (channel) {
      case NotificationChannel.EMAIL:
        return this.sendEmail(event, data);
      case NotificationChannel.SMS:
        return this.sendSMS(event, data);
      case NotificationChannel.WEBHOOK:
        return this.sendWebhook(event, data);
      case NotificationChannel.TELEGRAM:
        return this.sendTelegram(event, data);
      default:
        throw new Error(`Unsupported channel: ${channel}`);
    }
  }
}
```

## 安全考虑

### 1. 密码安全
- 使用 bcrypt 哈希（12 轮）
- 强制密码复杂度
- 密码历史记录
- 密码过期策略

### 2. 会话安全
- JWT 短期访问令牌
- 长期刷新令牌
- 令牌撤销机制
- 设备管理

### 3. API 密钥安全
- 密钥与密钥分离存储
- 权限最小化
- 定期轮换
- 使用记录审计

### 4. 数据安全
- 敏感信息加密
- 数据脱敏
- 访问日志
- 数据备份

## 故障处理

### 1. 数据库连接失败
- 自动重连
- 连接池管理
- 降级处理

### 2. 邮件发送失败
- 重试机制
- 备用邮件服务
- 队列处理

### 3. 认证失败
- 速率限制
- 账户锁定
- 安全通知

## 扩展性

### 1. 多租户支持
- 租户隔离
- 租户配置
- 租户管理

### 2. 插件系统
- 自定义验证器
- 自定义通知器
- 自定义存储

### 3. 微服务架构
- 服务发现
- 负载均衡
- 熔断器

## 参考文档

- [NestJS 文档](https://docs.nestjs.com/)
- [TypeScript 文档](https://www.typescriptlang.org/docs/)
- [PostgreSQL 文档](https://www.postgresql.org/docs/)
- [JWT 文档](https://jwt.io/)

---

**维护者**: 量化团队
**版本**: 1.0.0
**最后更新**: 2026-01-22