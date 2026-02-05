# Security Best Practices for NatsPubsub

This comprehensive guide covers security best practices for NatsPubsub deployments, including authentication, authorization, encryption, network security, and compliance requirements.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Authorization](#authorization)
- [Message Encryption](#message-encryption)
- [Network Security](#network-security)
- [Database Security](#database-security)
- [Secret Management](#secret-management)
- [Audit Logging](#audit-logging)
- [Security Monitoring](#security-monitoring)
- [Compliance](#compliance)
- [Security Checklist](#security-checklist)
- [Incident Response](#incident-response)

---

## Overview

Security in NatsPubsub involves multiple layers, from network transport to message content and data storage.

### Security Layers

```mermaid
graph TB
    subgraph "Transport Security"
        TLS[TLS/SSL Encryption]
        NET[Network Isolation]
    end

    subgraph "Authentication & Authorization"
        AUTH[NATS Authentication]
        AUTHZ[Subject-Level Authorization]
        API[API Keys]
    end

    subgraph "Message Security"
        ENC[End-to-End Encryption]
        SIG[Message Signing]
        VAL[Payload Validation]
    end

    subgraph "Data Security"
        DB[Database Encryption]
        BACKUP[Encrypted Backups]
        SECRETS[Secret Management]
    end

    subgraph "Monitoring & Compliance"
        AUDIT[Audit Logs]
        MON[Security Monitoring]
        COMP[Compliance Controls]
    end

    TLS --> AUTH
    NET --> AUTH
    AUTH --> AUTHZ
    AUTHZ --> ENC
    ENC --> DB
    DB --> AUDIT
    AUDIT --> MON

    style TLS fill:#e3f2fd
    style AUTH fill:#fff3e0
    style ENC fill:#e8f5e9
    style DB fill:#fce4ec
    style AUDIT fill:#f3e5f5
```

---

## Authentication

NatsPubsub has built-in support for all NATS authentication methods. Configure authentication via the `auth` config option (JavaScript) or individual config attributes (Ruby) — no raw NATS client code needed.

### Token-Based Authentication

```typescript
// JavaScript/TypeScript
NatsPubsub.configure({
  natsUrls: "nats://nats-server:4222",
  auth: { type: "token", token: process.env.NATS_TOKEN },
});
```

```ruby
# Ruby
NatsPubsub.configure do |config|
  config.nats_urls = 'nats://nats-server:4222'
  config.auth_token = ENV['NATS_TOKEN']
end
```

**Best Practices:**

- Use long, randomly generated tokens (minimum 32 characters)
- Rotate tokens regularly (every 90 days)
- Use different tokens per service
- Store tokens securely (environment variables, secrets manager)

### Username/Password Authentication

```typescript
// JavaScript/TypeScript
NatsPubsub.configure({
  natsUrls: "nats://nats-server:4222",
  auth: {
    type: "user-password",
    user: process.env.NATS_USER,
    pass: process.env.NATS_PASSWORD,
  },
});
```

```ruby
# Ruby
NatsPubsub.configure do |config|
  config.nats_urls = 'nats://nats-server:4222'
  config.auth_user = ENV['NATS_USER']
  config.auth_password = ENV['NATS_PASSWORD']
end
```

**Best Practices:**

- Use strong passwords (minimum 16 characters)
- Enable password hashing on NATS server (bcrypt)
- Implement password rotation policy
- Never hardcode credentials

### NKey Authentication

NKey provides public/private key authentication:

```typescript
// JavaScript/TypeScript
NatsPubsub.configure({
  natsUrls: "nats://nats-server:4222",
  auth: { type: "nkey", nkey: process.env.NATS_NKEY_SEED },
});
```

```ruby
# Ruby
NatsPubsub.configure do |config|
  config.nats_urls = 'nats://nats-server:4222'
  config.nkeys_seed = ENV['NATS_NKEYS_SEED']
end
```

**Advantages:**

- No password transmission
- Cryptographically secure
- Key rotation without server restart
- Audit trail of key usage

### Credentials File Authentication (Recommended)

Credentials files combine JWT and NKey for the strongest authentication with decentralized authorization:

```typescript
// JavaScript/TypeScript
NatsPubsub.configure({
  natsUrls: "nats://nats-server:4222",
  auth: { type: "credentials", credentialsPath: process.env.NATS_CREDENTIALS },
});
```

```ruby
# Ruby
NatsPubsub.configure do |config|
  config.nats_urls = 'nats://nats-server:4222'
  config.user_credentials = ENV['NATS_CREDENTIALS']
end
```

**NATS JWT Structure:**

```json
{
  "aud": "NATS",
  "exp": 1735689600,
  "iat": 1704153600,
  "iss": "operator",
  "jti": "unique-id",
  "sub": "service-name",
  "nats": {
    "permissions": {
      "pub": {
        "allow": ["production.app.>"]
      },
      "sub": {
        "allow": ["production.app.>"]
      }
    },
    "limits": {
      "payload": 1048576,
      "data": -1,
      "subs": -1
    }
  }
}
```

**Best Practices:**

- Use short expiration times (24 hours)
- Implement automatic JWT renewal
- Store NKey seeds securely
- Use account server for centralized management

### Authentication Implementation

```typescript
// packages/javascript/src/core/auth.ts
import { ConnectionOptions, NKeyAuth, connect } from "nats";

export class NatsAuthManager {
  async createSecureConnection(): Promise<Connection> {
    const authMethod = process.env.NATS_AUTH_METHOD || "token";

    let options: ConnectionOptions = {
      servers: process.env.NATS_URLS?.split(",") || ["nats://localhost:4222"],
      maxReconnectAttempts: -1,
      reconnectTimeWait: 2000,
      tls: this.getTLSConfig(),
    };

    switch (authMethod) {
      case "token":
        options.token = this.getToken();
        break;

      case "userpass":
        options.user = this.getUsername();
        options.pass = this.getPassword();
        break;

      case "nkey":
        options = { ...options, ...this.getNKeyAuth() };
        break;

      case "jwt":
        options.authenticator = this.getJWTAuth();
        break;

      default:
        throw new Error(`Unknown auth method: ${authMethod}`);
    }

    return await connect(options);
  }

  private getToken(): string {
    const token = process.env.NATS_TOKEN;
    if (!token) {
      throw new Error("NATS_TOKEN not set");
    }
    return token;
  }

  private getNKeyAuth(): NKeyAuth {
    const seed = process.env.NATS_NKEY_SEED;
    if (!seed) {
      throw new Error("NATS_NKEY_SEED not set");
    }

    const user = createUser();
    user.fromSeed(new TextEncoder().encode(seed));

    return {
      nkey: user.getPublicKey(),
      sigCB: (nonce: Uint8Array) => user.sign(nonce),
    };
  }

  private getJWTAuth(): Authenticator {
    const jwt = process.env.NATS_JWT;
    const seed = process.env.NATS_NKEY_SEED;

    if (!jwt || !seed) {
      throw new Error("NATS_JWT and NATS_NKEY_SEED required");
    }

    return jwtAuthenticator(jwt, new TextEncoder().encode(seed));
  }
}
```

---

## Authorization

### Subject-Level Permissions

Configure permissions in NATS server:

```conf
# nats-server.conf
authorization {
  users = [
    {
      user: "order-service"
      password: "$2a$11$..."
      permissions: {
        publish: {
          allow: ["production.orders.>"]
        }
        subscribe: {
          allow: ["production.orders.>", "production.payments.>"]
        }
      }
    },
    {
      user: "payment-service"
      password: "$2a$11$..."
      permissions: {
        publish: {
          allow: ["production.payments.>"]
        }
        subscribe: {
          allow: ["production.orders.>"]
        }
      }
    }
  ]
}
```

**Best Practices:**

- Use least privilege principle
- Grant only necessary subjects
- Use wildcards carefully
- Separate read and write permissions
- Regular permission audits

### JWT-Based Authorization

```javascript
// Generate JWT with permissions
const jwt = await createUserJWT(
  {
    name: "order-service",
    permissions: {
      pub: {
        allow: ["production.orders.>"],
        deny: ["production.orders.admin.>"],
      },
      sub: {
        allow: ["production.orders.>", "production.payments.completed"],
        deny: [],
      },
    },
    limits: {
      payload: 1048576, // 1MB max message size
      subs: 100, // Max 100 subscriptions
      data: -1, // Unlimited data
    },
  },
  accountKey,
);
```

### Application-Level Authorization

```typescript
// Middleware for authorization checks
class AuthorizationMiddleware implements Middleware {
  async call(
    event: Record<string, unknown>,
    metadata: EventMetadata,
    next: () => Promise<void>,
  ): Promise<void> {
    // Extract user context from metadata
    const userId = metadata.metadata?.user_id;
    const tenantId = metadata.metadata?.tenant_id;

    // Verify user has permission for this operation
    const hasPermission = await this.authService.checkPermission(
      userId,
      "process_order",
      tenantId,
    );

    if (!hasPermission) {
      throw new UnauthorizedError("User lacks permission");
    }

    await next();
  }
}

// Usage
NatsPubsub.use(new AuthorizationMiddleware());
```

---

## Message Encryption

### End-to-End Encryption

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

class MessageEncryption {
  private algorithm = "aes-256-gcm";
  private keyLength = 32; // 256 bits

  constructor(private encryptionKey: Buffer) {
    if (encryptionKey.length !== this.keyLength) {
      throw new Error("Encryption key must be 32 bytes");
    }
  }

  encrypt(data: string): EncryptedMessage {
    // Generate random IV
    const iv = randomBytes(16);

    // Create cipher
    const cipher = createCipheriv(this.algorithm, this.encryptionKey, iv);

    // Encrypt
    let encrypted = cipher.update(data, "utf8", "base64");
    encrypted += cipher.final("base64");

    // Get auth tag
    const authTag = cipher.getAuthTag();

    return {
      ciphertext: encrypted,
      iv: iv.toString("base64"),
      authTag: authTag.toString("base64"),
      algorithm: this.algorithm,
    };
  }

  decrypt(encrypted: EncryptedMessage): string {
    // Parse components
    const iv = Buffer.from(encrypted.iv, "base64");
    const authTag = Buffer.from(encrypted.authTag, "base64");

    // Create decipher
    const decipher = createDecipheriv(this.algorithm, this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    let decrypted = decipher.update(encrypted.ciphertext, "base64", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }
}

// Usage with NatsPubsub
class EncryptedPublisher {
  constructor(
    private encryption: MessageEncryption,
    private publisher: Publisher,
  ) {}

  async publish(topic: string, message: any): Promise<void> {
    // Encrypt message
    const json = JSON.stringify(message);
    const encrypted = this.encryption.encrypt(json);

    // Publish encrypted message
    await this.publisher.publishToTopic(topic, {
      encrypted: true,
      ...encrypted,
    });
  }
}

class EncryptedSubscriber extends Subscriber {
  constructor(
    subjects: string,
    private encryption: MessageEncryption,
  ) {
    super(subjects);
  }

  async handle(message: any, metadata: EventMetadata): Promise<void> {
    // Decrypt if encrypted
    if (message.encrypted) {
      const decrypted = this.encryption.decrypt(message);
      message = JSON.parse(decrypted);
    }

    await this.processMessage(message);
  }

  abstract processMessage(message: any): Promise<void>;
}
```

### Field-Level Encryption

```typescript
class FieldEncryption {
  constructor(private encryption: MessageEncryption) {}

  encryptFields<T extends Record<string, any>>(obj: T, fields: string[]): T {
    const result = { ...obj };

    for (const field of fields) {
      if (result[field] !== undefined) {
        const value = JSON.stringify(result[field]);
        result[field] = this.encryption.encrypt(value);
      }
    }

    return result;
  }

  decryptFields<T extends Record<string, any>>(obj: T, fields: string[]): T {
    const result = { ...obj };

    for (const field of fields) {
      if (result[field] !== undefined && result[field].encrypted) {
        const decrypted = this.encryption.decrypt(result[field]);
        result[field] = JSON.parse(decrypted);
      }
    }

    return result;
  }
}

// Usage
const sensitive = {
  order_id: "ORD-123",
  customer_email: "user@example.com",
  credit_card: "4111-1111-1111-1111",
  total: 99.99,
};

// Encrypt sensitive fields
const encrypted = fieldEncryption.encryptFields(sensitive, [
  "customer_email",
  "credit_card",
]);

await NatsPubsub.publish("order.created", encrypted);
```

### Message Signing

```typescript
import { createHmac } from "crypto";

class MessageSigning {
  constructor(private signingKey: string) {}

  sign(message: any): SignedMessage {
    const json = JSON.stringify(message);
    const signature = createHmac("sha256", this.signingKey)
      .update(json)
      .digest("base64");

    return {
      message,
      signature,
      timestamp: new Date().toISOString(),
    };
  }

  verify(signed: SignedMessage): boolean {
    const json = JSON.stringify(signed.message);
    const expectedSignature = createHmac("sha256", this.signingKey)
      .update(json)
      .digest("base64");

    // Timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(signed.signature),
      Buffer.from(expectedSignature),
    );
  }
}

// Usage
const signer = new MessageSigning(process.env.SIGNING_KEY!);

// Publisher
const signed = signer.sign({ order_id: "123", total: 99.99 });
await NatsPubsub.publish("order.created", signed);

// Subscriber
class SecureSubscriber extends Subscriber {
  async handle(message: any): Promise<void> {
    // Verify signature
    if (!signer.verify(message)) {
      throw new Error("Invalid message signature");
    }

    await this.processMessage(message.message);
  }
}
```

---

## Network Security

### TLS/SSL Configuration

NatsPubsub has built-in TLS support. Provide certificate paths in config and the library handles the rest.

```typescript
// JavaScript/TypeScript
NatsPubsub.configure({
  natsUrls: "tls://nats-server:4222",
  tls: {
    caFile: "/path/to/ca.crt",
    certFile: "/path/to/client.crt", // For mutual TLS
    keyFile: "/path/to/client.key", // For mutual TLS
  },
});
```

```ruby
# Ruby
NatsPubsub.configure do |config|
  config.nats_urls = 'tls://nats-server:4222'
  config.tls_ca_file = '/path/to/ca.crt'
  config.tls_cert_file = '/path/to/client.crt' # For mutual TLS
  config.tls_key_file = '/path/to/client.key'  # For mutual TLS
end
```

**Best Practices:**

- Always use TLS in production
- Use TLS 1.3 (or minimum 1.2)
- Enable certificate validation
- Use mutual TLS for critical services
- Rotate certificates regularly

### VPC and Network Isolation

```mermaid
graph TB
    subgraph "Public Internet"
        CLIENT[Clients]
    end

    subgraph "DMZ"
        LB[Load Balancer]
        API[API Gateway]
    end

    subgraph "Private VPC"
        subgraph "App Subnet"
            APP1[App Instance 1]
            APP2[App Instance 2]
        end

        subgraph "NATS Subnet"
            NATS1[NATS Server 1]
            NATS2[NATS Server 2]
            NATS3[NATS Server 3]
        end

        subgraph "Database Subnet"
            DB[(Database)]
        end
    end

    CLIENT --> LB
    LB --> API
    API --> APP1
    API --> APP2
    APP1 --> NATS1
    APP2 --> NATS2
    NATS1 --> NATS2
    NATS2 --> NATS3
    APP1 --> DB
    APP2 --> DB

    style CLIENT fill:#ffcdd2
    style LB fill:#fff9c4
    style NATS1 fill:#e1f5ff
    style NATS2 fill:#e1f5ff
    style NATS3 fill:#e1f5ff
    style DB fill:#c8e6c9
```

**Configuration:**

```yaml
# AWS Security Group for NATS
SecurityGroup:
  Name: nats-cluster-sg
  VPC: vpc-xxxxx
  InboundRules:
    # NATS client port (from app subnet only)
    - Protocol: TCP
      Port: 4222
      Source: sg-app-instances

    # NATS cluster port (from NATS subnet only)
    - Protocol: TCP
      Port: 6222
      Source: sg-nats-cluster

    # NATS monitoring port (from monitoring subnet)
    - Protocol: TCP
      Port: 8222
      Source: sg-monitoring

  OutboundRules:
    # Allow all outbound
    - Protocol: All
      Destination: 0.0.0.0/0
```

### Firewall Rules

```bash
# iptables rules for NATS server
#!/bin/bash

# Accept NATS client connections (from app servers)
iptables -A INPUT -p tcp --dport 4222 -s 10.0.1.0/24 -j ACCEPT

# Accept NATS cluster connections (from other NATS servers)
iptables -A INPUT -p tcp --dport 6222 -s 10.0.2.0/24 -j ACCEPT

# Accept monitoring connections (from monitoring subnet)
iptables -A INPUT -p tcp --dport 8222 -s 10.0.3.0/24 -j ACCEPT

# Drop all other connections to NATS ports
iptables -A INPUT -p tcp --dport 4222 -j DROP
iptables -A INPUT -p tcp --dport 6222 -j DROP
iptables -A INPUT -p tcp --dport 8222 -j DROP

# Allow established connections
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
```

---

## Database Security

### Encryption at Rest

**PostgreSQL:**

```sql
-- Enable transparent data encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create encrypted column
CREATE TABLE nats_outbox_events (
  event_id VARCHAR(255) PRIMARY KEY,
  subject VARCHAR(500) NOT NULL,
  payload TEXT NOT NULL,  -- Encrypted using pgcrypto
  encryption_iv BYTEA,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert with encryption
INSERT INTO nats_outbox_events (event_id, subject, payload, encryption_iv)
VALUES (
  'event-123',
  'order.created',
  pgp_sym_encrypt('{"order_id": "123"}', 'encryption-key'),
  gen_random_bytes(16)
);

-- Query with decryption
SELECT
  event_id,
  subject,
  pgp_sym_decrypt(payload::bytea, 'encryption-key') AS payload
FROM nats_outbox_events;
```

### Connection Security

```typescript
// Secure database connection
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  // SSL configuration
  ssl: {
    rejectUnauthorized: true,
    ca: readFileSync("/path/to/ca.crt").toString(),
    cert: readFileSync("/path/to/client.crt").toString(),
    key: readFileSync("/path/to/client.key").toString(),
  },

  // Connection limits
  max: 20,
  min: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,

  // Statement timeout
  statement_timeout: 30000,
});
```

### SQL Injection Prevention

```typescript
// ✅ Good: Use parameterized queries
async findByEventId(eventId: string): Promise<Event> {
  const query = 'SELECT * FROM nats_outbox_events WHERE event_id = $1';
  const result = await this.pool.query(query, [eventId]);
  return result.rows[0];
}

// ❌ Bad: String concatenation
async findByEventId(eventId: string): Promise<Event> {
  const query = `SELECT * FROM nats_outbox_events WHERE event_id = '${eventId}'`;
  const result = await this.pool.query(query);
  return result.rows[0];
}
```

### Row-Level Security

```sql
-- Enable row-level security
ALTER TABLE nats_outbox_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their tenant's events
CREATE POLICY tenant_isolation ON nats_outbox_events
  FOR ALL
  TO application_user
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Set tenant context
SET app.tenant_id = 'tenant-123';

-- Now queries are automatically filtered
SELECT * FROM nats_outbox_events;  -- Only returns events for tenant-123
```

---

## Secret Management

### Environment Variables (Basic)

```bash
# .env (NEVER commit to git)
NATS_TOKEN=super-secret-token-minimum-32-chars
NATS_NKEY_SEED=SUAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
DATABASE_URL=postgresql://user:pass@localhost:5432/db
ENCRYPTION_KEY=32-byte-hex-encoded-key-here
```

```typescript
// Load from environment
import { config } from "dotenv";
config();

const natsToken = process.env.NATS_TOKEN;
if (!natsToken) {
  throw new Error("NATS_TOKEN not set");
}
```

### AWS Secrets Manager

```typescript
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

class SecretsManager {
  private client = new SecretsManagerClient({ region: process.env.AWS_REGION });
  private cache = new Map<string, { value: string; expires: number }>();

  async getSecret(secretName: string): Promise<string> {
    // Check cache
    const cached = this.cache.get(secretName);
    if (cached && Date.now() < cached.expires) {
      return cached.value;
    }

    // Fetch from AWS
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await this.client.send(command);

    if (!response.SecretString) {
      throw new Error(`Secret ${secretName} not found`);
    }

    // Cache for 5 minutes
    this.cache.set(secretName, {
      value: response.SecretString,
      expires: Date.now() + 300000,
    });

    return response.SecretString;
  }
}

// Usage
const secrets = new SecretsManager();
const natsToken = await secrets.getSecret("prod/nats/token");
const dbPassword = await secrets.getSecret("prod/db/password");
```

### HashiCorp Vault

```typescript
import got from "got";

class VaultClient {
  constructor(
    private vaultUrl: string,
    private token: string,
  ) {}

  async getSecret(path: string): Promise<any> {
    const response = await got.get(`${this.vaultUrl}/v1/${path}`, {
      headers: {
        "X-Vault-Token": this.token,
      },
      responseType: "json",
    });

    return response.body.data;
  }

  async renewToken(): Promise<void> {
    await got.post(`${this.vaultUrl}/v1/auth/token/renew-self`, {
      headers: {
        "X-Vault-Token": this.token,
      },
    });
  }
}

// Usage
const vault = new VaultClient(process.env.VAULT_URL!, process.env.VAULT_TOKEN!);

const secrets = await vault.getSecret("secret/data/nats");
const natsToken = secrets.token;
```

### Kubernetes Secrets

```yaml
# kubernetes-secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: nats-credentials
type: Opaque
stringData:
  nats-token: "super-secret-token"
  nats-nkey: "SUAXXXXXXXXXXXXX"
  encryption-key: "32-byte-key-here"
---
apiVersion: v1
kind: Pod
metadata:
  name: app
spec:
  containers:
    - name: app
      image: my-app:latest
      env:
        - name: NATS_TOKEN
          valueFrom:
            secretKeyRef:
              name: nats-credentials
              key: nats-token
        - name: ENCRYPTION_KEY
          valueFrom:
            secretKeyRef:
              name: nats-credentials
              key: encryption-key
```

### Secret Rotation

```typescript
class RotatingSecrets {
  private currentSecret: string;
  private previousSecret: string | null = null;
  private rotationInterval = 3600000; // 1 hour

  constructor(private secretsManager: SecretsManager) {
    this.startRotation();
  }

  private async startRotation(): Promise<void> {
    setInterval(async () => {
      await this.rotate();
    }, this.rotationInterval);
  }

  private async rotate(): Promise<void> {
    // Get new secret
    const newSecret = await this.secretsManager.getSecret("nats/token");

    // Save current as previous
    this.previousSecret = this.currentSecret;

    // Update current
    this.currentSecret = newSecret;

    console.log("Secret rotated successfully");

    // After grace period, remove previous
    setTimeout(() => {
      this.previousSecret = null;
    }, 300000); // 5 minute grace period
  }

  getSecret(): string {
    return this.currentSecret;
  }

  validateSecret(secret: string): boolean {
    return secret === this.currentSecret || secret === this.previousSecret;
  }
}
```

---

## Audit Logging

### Structured Audit Logs

```typescript
interface AuditLog {
  timestamp: string;
  level: "info" | "warn" | "error";
  event: string;
  actor: {
    userId?: string;
    serviceId: string;
    ipAddress?: string;
  };
  resource: {
    type: string;
    id: string;
  };
  action: string;
  result: "success" | "failure";
  details?: Record<string, unknown>;
  traceId?: string;
}

class AuditLogger {
  log(entry: AuditLog): void {
    // Log to structured logging system
    console.log(
      JSON.stringify({
        ...entry,
        timestamp: entry.timestamp || new Date().toISOString(),
      }),
    );

    // Also send to audit log storage
    this.sendToAuditStorage(entry);
  }

  private async sendToAuditStorage(entry: AuditLog): Promise<void> {
    // Send to dedicated audit log database or service
    await this.auditStorage.store(entry);
  }
}

// Usage
const auditLogger = new AuditLogger();

// Publish audit
auditLogger.log({
  timestamp: new Date().toISOString(),
  level: "info",
  event: "message.published",
  actor: {
    userId: "user-123",
    serviceId: "order-service",
    ipAddress: "192.168.1.100",
  },
  resource: {
    type: "message",
    id: "event-456",
  },
  action: "publish",
  result: "success",
  details: {
    topic: "order.created",
    messageSize: 1024,
  },
  traceId: "trace-789",
});

// Subscribe audit
auditLogger.log({
  timestamp: new Date().toISOString(),
  level: "info",
  event: "message.processed",
  actor: {
    serviceId: "payment-service",
  },
  resource: {
    type: "message",
    id: "event-456",
  },
  action: "process",
  result: "success",
  details: {
    processingTime: 150,
  },
  traceId: "trace-789",
});
```

### Audit Middleware

```typescript
class AuditMiddleware implements Middleware {
  constructor(private auditLogger: AuditLogger) {}

  async call(
    event: Record<string, unknown>,
    metadata: EventMetadata,
    next: () => Promise<void>,
  ): Promise<void> {
    const start = Date.now();

    try {
      await next();

      // Log successful processing
      this.auditLogger.log({
        timestamp: new Date().toISOString(),
        level: "info",
        event: "message.processed",
        actor: {
          serviceId: process.env.SERVICE_NAME!,
        },
        resource: {
          type: "message",
          id: metadata.eventId,
        },
        action: "process",
        result: "success",
        details: {
          subject: metadata.subject,
          processingTime: Date.now() - start,
        },
        traceId: metadata.metadata?.trace_id as string,
      });
    } catch (error) {
      // Log failed processing
      this.auditLogger.log({
        timestamp: new Date().toISOString(),
        level: "error",
        event: "message.processing.failed",
        actor: {
          serviceId: process.env.SERVICE_NAME!,
        },
        resource: {
          type: "message",
          id: metadata.eventId,
        },
        action: "process",
        result: "failure",
        details: {
          subject: metadata.subject,
          error: error.message,
        },
        traceId: metadata.metadata?.trace_id as string,
      });

      throw error;
    }
  }
}
```

---

## Security Monitoring

### Anomaly Detection

```typescript
class SecurityMonitor {
  private readonly thresholds = {
    maxPublishRate: 1000, // messages per second
    maxFailureRate: 0.1, // 10% failure rate
    maxRetryAttempts: 5,
    suspiciousPatterns: [
      /\bSELECT\b.*\bFROM\b/i, // SQL injection patterns
      /\bUNION\b.*\bSELECT\b/i,
      /<script>/i, // XSS patterns
    ],
  };

  private metrics = {
    publishCount: 0,
    failureCount: 0,
    lastReset: Date.now(),
  };

  async checkMessage(message: any, metadata: EventMetadata): Promise<void> {
    // Update metrics
    this.metrics.publishCount++;

    // Check rate limit
    const elapsed = Date.now() - this.metrics.lastReset;
    if (elapsed >= 1000) {
      const rate = this.metrics.publishCount / (elapsed / 1000);

      if (rate > this.thresholds.maxPublishRate) {
        await this.alert({
          type: "rate_limit_exceeded",
          rate,
          threshold: this.thresholds.maxPublishRate,
        });
      }

      // Reset metrics
      this.metrics.publishCount = 0;
      this.metrics.failureCount = 0;
      this.metrics.lastReset = Date.now();
    }

    // Check for suspicious patterns
    const messageStr = JSON.stringify(message);
    for (const pattern of this.thresholds.suspiciousPatterns) {
      if (pattern.test(messageStr)) {
        await this.alert({
          type: "suspicious_pattern",
          pattern: pattern.toString(),
          message: messageStr.substring(0, 100),
          eventId: metadata.eventId,
        });
      }
    }

    // Check failure rate
    const failureRate = this.metrics.failureCount / this.metrics.publishCount;
    if (failureRate > this.thresholds.maxFailureRate) {
      await this.alert({
        type: "high_failure_rate",
        rate: failureRate,
        threshold: this.thresholds.maxFailureRate,
      });
    }
  }

  private async alert(details: Record<string, unknown>): Promise<void> {
    console.error("SECURITY ALERT:", details);
    // Send to security monitoring system
    await this.sendToSecuritySystem(details);
  }
}
```

### Intrusion Detection

```typescript
class IntrusionDetection {
  private attempts = new Map<string, number>();
  private blocklist = new Set<string>();

  async checkAccess(clientId: string, action: string): Promise<boolean> {
    // Check if blocked
    if (this.blocklist.has(clientId)) {
      await this.alert({
        type: "blocked_client_attempt",
        clientId,
        action,
      });
      return false;
    }

    // Track failed attempts
    const attempts = this.attempts.get(clientId) || 0;

    if (attempts >= 5) {
      // Block after 5 failed attempts
      this.blocklist.add(clientId);

      await this.alert({
        type: "client_blocked",
        clientId,
        attempts,
      });

      return false;
    }

    return true;
  }

  recordFailure(clientId: string): void {
    const attempts = this.attempts.get(clientId) || 0;
    this.attempts.set(clientId, attempts + 1);
  }

  recordSuccess(clientId: string): void {
    this.attempts.delete(clientId);
  }
}
```

---

## Compliance

### GDPR Compliance

```typescript
class GDPRCompliance {
  // Right to be forgotten
  async deleteUserData(userId: string): Promise<void> {
    // Delete from Outbox
    await this.db.query(
      "DELETE FROM nats_outbox_events WHERE payload LIKE $1",
      [`%"user_id":"${userId}"%`],
    );

    // Delete from Inbox
    await this.db.query("DELETE FROM nats_inbox_events WHERE payload LIKE $1", [
      `%"user_id":"${userId}"%`,
    ]);

    // Delete from audit logs (after retention period)
    await this.deleteAuditLogs(userId);

    // Log deletion
    await this.auditLogger.log({
      timestamp: new Date().toISOString(),
      level: "info",
      event: "user.data.deleted",
      actor: { userId },
      resource: { type: "user", id: userId },
      action: "delete",
      result: "success",
    });
  }

  // Data portability
  async exportUserData(userId: string): Promise<any> {
    const data = {
      outbox: await this.getOutboxEvents(userId),
      inbox: await this.getInboxEvents(userId),
      auditLogs: await this.getAuditLogs(userId),
    };

    return data;
  }

  // Data anonymization
  async anonymizeUserData(userId: string): Promise<void> {
    const anonymousId = `anonymous-${generateId()}`;

    await this.db.query(
      `UPDATE nats_outbox_events
       SET payload = REPLACE(payload, $1, $2)
       WHERE payload LIKE $3`,
      [userId, anonymousId, `%${userId}%`],
    );

    // Log anonymization
    await this.auditLogger.log({
      timestamp: new Date().toISOString(),
      level: "info",
      event: "user.data.anonymized",
      actor: { userId },
      resource: { type: "user", id: userId },
      action: "anonymize",
      result: "success",
    });
  }
}
```

### SOC 2 Compliance

```typescript
class SOC2Compliance {
  // Access control
  async enforceAccessControl(
    userId: string,
    resource: string,
    action: string,
  ): Promise<boolean> {
    // Check permissions
    const hasPermission = await this.checkPermission(userId, resource, action);

    // Log access attempt
    await this.auditLogger.log({
      timestamp: new Date().toISOString(),
      level: "info",
      event: "access.control.check",
      actor: { userId },
      resource: { type: resource, id: resource },
      action,
      result: hasPermission ? "success" : "failure",
    });

    return hasPermission;
  }

  // Change management
  async logChange(change: {
    resource: string;
    before: any;
    after: any;
    userId: string;
  }): Promise<void> {
    await this.auditLogger.log({
      timestamp: new Date().toISOString(),
      level: "info",
      event: "resource.changed",
      actor: { userId: change.userId },
      resource: { type: "configuration", id: change.resource },
      action: "update",
      result: "success",
      details: {
        before: change.before,
        after: change.after,
      },
    });
  }

  // Incident response
  async logIncident(incident: {
    type: string;
    severity: "low" | "medium" | "high" | "critical";
    description: string;
    affectedSystems: string[];
  }): Promise<void> {
    await this.auditLogger.log({
      timestamp: new Date().toISOString(),
      level: "error",
      event: "security.incident",
      actor: { serviceId: "security-system" },
      resource: { type: "system", id: "security" },
      action: "incident",
      result: "failure",
      details: incident,
    });

    // Alert security team
    await this.alertSecurityTeam(incident);
  }
}
```

---

## Security Checklist

### Pre-Production Checklist

- [ ] **Authentication**
  - [ ] Use JWT or NKey authentication
  - [ ] Rotate credentials regularly
  - [ ] Store secrets securely
  - [ ] Implement MFA for admin access

- [ ] **Authorization**
  - [ ] Configure subject-level permissions
  - [ ] Use least privilege principle
  - [ ] Regular permission audits
  - [ ] Separate read/write permissions

- [ ] **Encryption**
  - [ ] Enable TLS for all connections
  - [ ] Use TLS 1.3 or minimum 1.2
  - [ ] Encrypt sensitive message fields
  - [ ] Enable database encryption at rest

- [ ] **Network**
  - [ ] Configure VPC and subnets
  - [ ] Set up security groups
  - [ ] Enable firewall rules
  - [ ] Use private networks

- [ ] **Database**
  - [ ] Use SSL connections
  - [ ] Enable encryption at rest
  - [ ] Implement row-level security
  - [ ] Use parameterized queries

- [ ] **Monitoring**
  - [ ] Enable audit logging
  - [ ] Set up security alerts
  - [ ] Monitor access patterns
  - [ ] Track failed attempts

- [ ] **Compliance**
  - [ ] Implement data retention policies
  - [ ] Enable data anonymization
  - [ ] Document security controls
  - [ ] Regular security audits

---

## Incident Response

### Incident Response Plan

```typescript
class IncidentResponse {
  async handleSecurityIncident(incident: SecurityIncident): Promise<void> {
    // 1. Detect and log
    await this.logIncident(incident);

    // 2. Contain
    await this.containThreat(incident);

    // 3. Investigate
    const analysis = await this.investigate(incident);

    // 4. Remediate
    await this.remediate(incident, analysis);

    // 5. Recover
    await this.recover(incident);

    // 6. Post-incident review
    await this.postIncidentReview(incident, analysis);
  }

  private async containThreat(incident: SecurityIncident): Promise<void> {
    switch (incident.type) {
      case "unauthorized_access":
        // Revoke credentials
        await this.revokeCredentials(incident.affectedCredentials);
        break;

      case "data_breach":
        // Isolate affected systems
        await this.isolateSystems(incident.affectedSystems);
        break;

      case "ddos":
        // Enable rate limiting
        await this.enableRateLimiting();
        break;
    }
  }

  private async investigate(incident: SecurityIncident): Promise<Analysis> {
    // Collect logs
    const logs = await this.collectLogs(incident.timeRange);

    // Analyze patterns
    const patterns = await this.analyzePatterns(logs);

    // Identify root cause
    const rootCause = await this.identifyRootCause(patterns);

    return { logs, patterns, rootCause };
  }
}
```

---

## Related Documentation

- [Architecture Guide](./architecture.md) - System architecture
- [Internals Guide](./internals.md) - Internal implementation
- [Deployment Guide](../guides/deployment.md) - Deployment setup

---

**Navigation:**

- [← Previous: Custom Repositories](./custom-repositories.md)
- [Back to Documentation Home](../index.md)
