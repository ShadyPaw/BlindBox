# BlindBox

BlindBox 是一个使用 pnpm 管理的 TypeScript monorepo。

**当前阶段：基础工程和前台预览已建立，尚未完成完整的 1:1 还原，也没有真实账户、开箱或交易服务。** 页面使用本地展示数据和图片，排行榜为参考快照。

## 项目当前情况

| 模块       | 已完成                                                                 | 当前边界                                            |
| ---------- | ---------------------------------------------------------------------- | --------------------------------------------------- |
| Web        | 首页、列表、详情路由、免费模式、VIP 福利、排行榜、登录弹窗、移动端布局 | 仍需补齐内容并逐页进行视觉对照                      |
| 消费盲盒   | 36 款名称、价格、图片及独立详情路由；搜索、筛选、排序                  | 仅 3 款具有完整物品清单                             |
| 金币盲盒   | 18 款名称、价格、图片及独立详情路由；模式切换                          | 仅 Cozy Christmas 具有完整物品清单                  |
| 账户界面   | 验证登录、密码登录、显示密码、忘记密码表单                             | 未接入验证、注册或 Google OAuth；不发送或持久化账密 |
| Admin      | 独立 Next.js 应用、健康检查                                            | 占位页面，没有业务后台或权限系统                    |
| API        | NestJS + Fastify、健康检查、环境校验、结构化日志                       | 没有业务接口                                        |
| Worker     | BullMQ 消费者、健康检查、优雅退出                                      | 只有基础设施探测任务                                |
| 数据与部署 | PostgreSQL、Prisma、Redis、Compose、CI 配置                            | 无业务模型和初始迁移；尚未线上部署                  |

具备完整公开物品数据的盲盒为 Everyday Sync、One Piece Voyage、Next-Gen Discovery 和金币模式的 Cozy Christmas。其余 50 款详情页明确显示数据缺口，没有编造物品或概率。

前台还支持数量选择、开箱选项开关、分享、物品信息弹窗、欢迎礼物、VIP 未登录提示和社群链接。音效、极速开箱等开关目前只切换前端状态，不代表已有真实开箱能力。

### 待完成

- 补齐 33 款消费盲盒和 17 款金币盲盒的物品清单及说明。
- 补齐政策文章、语言选择、活动弹窗内容和客服交互。
- 对照字体、排行榜素材、图标、间距及桌面／手机视觉效果。部分原站素材下载返回 403，目前使用回退样式。
- 空投、背包、个人中心等登录后页面，按当前安排留到后续。
- 账户鉴权、业务数据库、真实开箱、支付、提现、配送、实时排行榜和后台管理。

详细覆盖范围见 [前台还原状态](docs/frontend-status.md)。当前版本不能视为像素级验收完成或可直接开展业务运营的产品。

## 技术栈与目录

- pnpm 10、TypeScript 严格模式、ESLint、Prettier。
- Next.js App Router、React；NestJS + Fastify。
- PostgreSQL 17、Prisma 7、Redis 7.4、BullMQ。
- Zod 环境变量校验、Pino JSON 日志及敏感字段脱敏。
- Vitest、Playwright、GitHub Actions。

```text
apps/
  web/          公开前台
  admin/        管理端基础应用
  api/          NestJS + Fastify API
  worker/       BullMQ Worker
packages/
  database/     Prisma 客户端、PostgreSQL 适配器与 schema
  ui/           基础共享 React 组件
  config/       TypeScript、ESLint 配置
  types/        共享类型与基础设施任务约定
  validation/   环境变量校验
  logger/       结构化日志
scripts/        环境初始化、standalone 构建与启动脚本
tests/          单元、集成及浏览器测试
docs/           开发状态说明
```

前台数据位于 `apps/web/src/data/reference.json`、`details.json` 和 `coin-boxes.json`；公开页面素材快照位于 `apps/web/public/reference`。

## 本地启动

需要 Node.js 22.14 或更新的 22.x 版本、pnpm 10.16.1。启动 PostgreSQL 和 Redis 还需要 Docker 与 Compose v2。

### 只预览前台

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm build:packages
pnpm --filter @box/web dev
```

打开 <http://localhost:3000>。展示前台不需要数据库和 Redis；首次先构建共享包，供启动时的环境校验及日志模块使用。

### 完整开发环境

```sh
pnpm dev:setup
pnpm infra:up
pnpm dev
```

`dev:setup` 从 `.env.example` 创建根目录 `.env`，不会覆盖已有文件。API 和 Worker 读取根目录环境文件；Next.js 使用应用级环境文件机制。生产环境通过环境变量注入配置，服务端凭据不应放入 `NEXT_PUBLIC_*`。

| 应用   | 默认地址              | 健康检查                   |
| ------ | --------------------- | -------------------------- |
| Web    | http://localhost:3000 | `/health`                  |
| Admin  | http://localhost:3001 | `/health`                  |
| API    | http://localhost:3002 | `/health`、`/health/ready` |
| Worker | http://localhost:3003 | `/health`、`/health/ready` |

API 就绪检查会查询 PostgreSQL 并执行 Redis PING，依赖不可用时返回 503。Worker 就绪检查确认消费者和 Redis 连接状态。存活检查不依赖数据库或 Redis。

## 检查与测试

首次安装测试浏览器，然后运行完整检查：

```sh
pnpm exec playwright install --no-shell chromium
pnpm check
```

`pnpm check` 依次执行格式检查、lint、类型检查、单元测试、全部应用构建及浏览器测试。Windows 可使用已安装的 Chrome：

```powershell
$env:PLAYWRIGHT_CHANNEL='chrome'
pnpm check
```

各项命令也可单独运行：

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm db:validate
pnpm build
pnpm test:e2e
pnpm test:integration
```

集成测试需要可访问的 PostgreSQL 和 Redis，应使用独立测试实例。它验证数据库查询、就绪状态和 BullMQ 任务生命周期，测试 Worker 使用 13003 端口。

截至 2026-09-18，最近一轮本地 `pnpm check` 已通过：**17 项单元测试、8 项浏览器测试，以及格式、lint、类型和构建检查**。基础设施集成测试此前已通过。本机尚未完成 Docker 容器验证，远程 CI 结果以仓库 Actions 页面为准。

GitHub Actions 配置了代码检查、数据库校验、单元／集成／浏览器测试，以及独立的容器构建和健康检查任务。

## 数据库与容器

```sh
pnpm db:generate
pnpm db:validate
pnpm db:migrate --name descriptive_change
pnpm db:deploy
```

当前 schema 没有业务模型和初始迁移。业务建模后再创建并提交迁移；生产迁移作为独立发布步骤执行。Prisma 生成代码不提交到 Git，会在构建前生成。

```sh
docker compose --profile apps up --build -d --wait
docker compose --profile apps down
```

不启用 `apps` profile 时，Compose 只启动 PostgreSQL 和 Redis。`pnpm infra:down` 保留数据卷。Dockerfile 提供四个应用的生产构建目标，前端采用 Next.js standalone 输出，运行镜像使用非 root 用户。

示例环境变量及 Compose 凭据仅用于本地开发。实际部署还需要密钥管理、TLS、基础设施隔离、备份、监控，以及尚未实现的业务鉴权。

## 更新日志

以下按开发阶段整理，日期为首次整理上传当前代码的日期，不代表已发布正式版本。

### 2026-09-18 · 免费模式与前台回归

- 新增 18 款金币盲盒、模式切换和独立详情路由。
- 补齐 Cozy Christmas 的 18 件物品、图片、概率与说明。
- 接通公开社群链接，修复登录弹窗中政策跳转后未关闭的问题。
- 调整免费模式选中态及卡片价格布局。
- 增加免费模式和弹窗导航测试，修复跳转完成前刷新导致的测试时序问题；8 项浏览器测试通过。

### 2026-09-18 · 公开前台首版

- 实现首页、36 款消费盲盒列表及详情路由、VIP 福利、排行榜和共用导航。
- 实现搜索、筛选、排序、数量选择、分享、信息弹窗及账户表单状态。
- 补齐三款消费盲盒的公开物品数据，加入本地图片和移动端布局。
- 添加前台状态文档，记录内容缺口、视觉差异和后续范围。

### 2026-09-18 · 工程初始化

- 建立四个应用、六个共享包的 pnpm TypeScript monorepo。
- 配置严格类型检查、ESLint、Prettier、Vitest、Playwright 和 CI。
- 接入 NestJS/Fastify、Prisma/PostgreSQL、Redis、BullMQ、环境校验及结构化日志。
- 添加健康端点、开发脚本、多阶段 Dockerfile 和 Docker Compose。
