# NeuraChar Database Schema

Updated at: 2025-12-12
Source: [src/db/models.py](file:///e:/code/NeuraChar/src/db/models.py)

## Overview

The database uses PostgreSQL and consists of 5 main tables handling users, authentication, characters, chats, and messages.

## Tables

### 1. `users`
Stores user account information.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| [id](file:///e:/code/NeuraChar/src/api/schemas.py#96-99) | UUID | No | `uuid4()` | Primary Key |
| `email` | String(255) | No | - | Unique email address |
| `username` | String(50) | Yes | - | User display name |
| `avatar_url` | Text | Yes | - | URL to user avatar |
| `created_at` | TIMESTAMP | No | `now()` | Account creation time |
| `last_login_at` | TIMESTAMP | Yes | - | Last login timestamp |
| `provider` | String(50) | No | `'email_qq'` | Auth provider type |

### 2. `email_login_codes`
Stores temporary verification codes for email login.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| [id](file:///e:/code/NeuraChar/src/api/schemas.py#96-99) | Integer | No | `autoincrement` | Primary Key |
| `email` | String(255) | No | - | Target email |
| `code_hash` | String(255) | No | - | Hashed verification code |
| `created_at` | TIMESTAMP | No | `now()` | Generation time |
| `expires_at` | TIMESTAMP | No | - | Expiration time |
| `used_at` | TIMESTAMP | Yes | - | Usage time (if used) |
| `ip_address` | String(45) | Yes | - | Request IP address |

### 3. [characters](file:///e:/code/NeuraChar/src/api/routers/characters.py#51-81)
Stores virtual character definitions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| [id](file:///e:/code/NeuraChar/src/api/schemas.py#96-99) | UUID | No | `uuid4()` | Primary Key |
| `name` | String(100) | No | - | Character name |
| `system_prompt` | Text | No | - | Core persona instructions |
| `greeting_message` | Text | Yes | - | Initial chat greeting |
| `avatar_url` | Text | Yes | - | Character avatar URL |
| `tags` | JSONB | Yes | - | List of tags (e.g. `["friendly"]`) |
| `is_public` | Boolean | No | `False` | **True** if visible in Market |
| `creator_id` | UUID | Yes | - | FK to `users.id` |

### 4. `chats`
Represents a conversation session between a user and a character.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `chat_id` | UUID | No | `uuid4()` | Primary Key |
| `user_id` | UUID | No | - | FK to `users.id` |
| `character_id` | UUID | No | - | FK to `characters.id` |
| `created_at` | TIMESTAMP | No | `now()` | Session start time |

### 5. `messages`
Stores individual messages within a chat.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| [id](file:///e:/code/NeuraChar/src/api/schemas.py#96-99) | UUID | No | `uuid4()` | Primary Key |
| `chat_id` | UUID | No | - | FK to `chats.chat_id` |
| `role` | String(20) | No | - | 'user', 'assistant', or 'system' |
| `content` | Text | No | - | Message text content |
| `created_at` | TIMESTAMP | No | `now()` | Message timestamp |

## Relationships

- **User -> Characters**: One-to-Many (Creator)
- **User -> Chats**: One-to-Many
- **Character -> Chats**: One-to-Many
- **Chat -> Messages**: One-to-Many (Cascade Delete)
