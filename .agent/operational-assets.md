# 运营资产变更方法

更新时间：2026-05-06

## 1. 文档范围

本文记录不需要数据库迁移、不需要调整前端 UI 结构的运营资产变更方法。

当前覆盖范围：

- Discover 首页 Hero 轮播图。
- 后续如果新增 Banner、活动入口图、专题封面等运营资产，可以继续追加到本文。

本文只记录资产上传、配置切换、验证和回滚方式；设计系统、数据库结构、接口总览仍以对应专项文档为准。

## 2. Discover 首页 Hero 轮播图

### 2.1 当前结构

Discover 首页 Hero 轮播图由后端配置驱动：

- 前端首页调用 `GET /v1/discover/config`。
- 后端读取 `E:\code\parlasoul-backend\config\discover.json`。
- 响应中的 `hero_items` 控制轮播项、顺序和图片。
- 前端 `HeroCarousel` 使用接口返回的 `image_url` 渲染图片，不再维护本地硬编码图片映射。

`hero_items` 单项字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `character_id` | string | 轮播项点击后进入的角色 ID，必须对应已存在的 Discover 角色。 |
| `image_key` | string | R2 对象 key，固定使用 `images/discover/heroes/` 前缀。 |
| `image_url` | string | 后端根据 `image_key` 生成的可访问图片 URL，通常是 R2 public URL。 |
| `cta_text` | string | 按钮文案，未配置时按后端默认值处理。 |

当前基线配置：

| 角色 | `image_key` |
| --- | --- |
| Elon | `images/discover/heroes/hero-20260507-elon-alpine-lake.jpg` |
| Gork | `images/discover/heroes/gork-21-9.jpg` |
| Bai | `images/discover/heroes/bai-21-9.jpg` |

### 2.2 图片制作要求

Hero 轮播图是专门制作的运营资产，不是角色头像变体。

建议规格：

- 画幅：21:9。
- 当前参考尺寸：`3168x1344` 或 `1584x672`。
- 格式：优先使用 `jpg` 或 `webp`。
- 文件大小：不要超过后端 `MEDIA_MAX_UPLOAD_BYTES` 限制，当前默认上限为 `5MB`。
- 支持的 MIME：`image/jpeg`、`image/png`、`image/webp`、`image/avif`。

替换已上线图片时，建议使用新的 `image_key`，不要覆盖旧对象。Hero 图片会经过长缓存策略，覆盖同名对象可能导致不同用户看到的图片不一致。

### 2.3 上传图片到 R2

内部接口：

```http
POST /v1/internal/discover/hero-image
Content-Type: multipart/form-data
```

表单字段：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `file` | 是 | 要上传的 Hero 图片文件。 |
| `key_hint` | 否 | 稳定的文件名提示，后端会清洗并根据 MIME 补扩展名。 |
| `secret` | 是 | 内部密码，值为 `666666`。 |

PowerShell 示例：

```powershell
curl.exe -X POST "http://localhost:8000/v1/internal/discover/hero-image" `
  -F "secret=666666" `
  -F "key_hint=hero-20260506-elon" `
  -F "file=@E:\path\to\hero.jpg;type=image/jpeg"
```

响应中需要关注：

```json
{
  "data": {
    "image_key": "images/discover/heroes/hero-20260506-elon.jpg",
    "image_url": "https://pub-xxx.r2.dev/images/discover/heroes/hero-20260506-elon.jpg",
    "object_key": "images/discover/heroes/hero-20260506-elon.jpg",
    "content_type": "image/jpeg",
    "size_bytes": 2134520,
    "width": 3168,
    "height": 1344
  }
}
```

注意事项：

- `secret` 密码不要泄露或提交到代码仓库。
- `key_hint` 只作为文件名提示，不需要包含 `images/discover/heroes/` 前缀。
- 接口会统一写入 `images/discover/heroes/` 前缀。
- 上传成功后，以响应里的 `image_key` 作为配置值。

### 2.4 切换轮播项

修改后端配置文件：

```text
E:\code\parlasoul-backend\config\discover.json
```

示例：

```json
{
  "hero_items": [
    {
      "character_id": "7419dcae-bc5f-4f4b-85f5-bbbebcdb61d8",
      "image_key": "images/discover/heroes/hero-20260506-elon.jpg",
      "cta_text": "开始对话"
    },
    {
      "character_id": "4829fd3a-e63f-462f-9192-48840a55dbae",
      "image_key": "images/discover/heroes/hero-20260506-gork.jpg",
      "cta_text": "开始对话"
    }
  ]
}
```

配置规则：

- `hero_items` 的数组顺序就是前端轮播顺序。
- `character_id` 必须对应 Discover 可展示角色。
- `image_key` 必须使用 `images/discover/heroes/` 前缀。
- 不要在 `image_key` 中使用嵌套目录。
- 如果只是换图，不需要改前端代码。
- 如果只是调整轮播顺序，不需要重新上传图片。
- 如果要下线某个轮播项，从 `hero_items` 数组移除即可。

### 2.5 验证方式

检查配置接口：

```powershell
Invoke-WebRequest -UseBasicParsing "http://localhost:8000/v1/discover/config" |
  Select-Object -ExpandProperty Content
```

检查图片是否可访问：

```powershell
curl.exe -I "https://pub-xxx.r2.dev/images/discover/heroes/hero-20260506-elon.jpg"
```

前端基础验证：

```powershell
pnpm typecheck
pnpm test
```

如果修改了前端配置或图片域名白名单，再额外运行：

```powershell
pnpm build
```

浏览器人工检查：

- 打开前端首页。
- 确认轮播顺序符合 `hero_items`。
- 确认图片加载地址是接口返回的 R2 public URL。
- 确认点击轮播项后进入正确角色。

不要使用 `localhost:3001/media/...` 作为 Hero 大图访问的最终判断依据。Hero 图以接口返回的 R2 public URL 为准。

### 2.6 回滚方式

如果新图或新配置有问题：

- 将 `E:\code\parlasoul-backend\config\discover.json` 中对应 `image_key` 改回上一版。
- 如果是角色绑定错误，恢复上一版 `character_id` 或移除该轮播项。
- 不要立刻删除 R2 上的旧图片对象；线上用户和缓存仍可能引用旧 URL。
- 修改后重新请求 `GET /v1/discover/config`，确认接口已返回上一版配置。
