# Phase 3：Catalog

目录数据链路：显式初始化快照 → PostgreSQL → Catalog Query Service → 公共 API → Next.js 运行时请求 → 页面。

本阶段只有公开读取能力，不创建钱包扣款、支付、开奖结果、库存、管理员写接口或开奖配置。现有 54 款盲盒中，4 款有已收集的物品明细；另外 50 款继续标记资料不完整。

## 初始化与开发

```sh
pnpm install --frozen-lockfile
pnpm dev:setup
pnpm infra:up
pnpm build:packages
pnpm db:deploy
pnpm db:seed:catalog
pnpm dev
```

seed 是独立且显式的 bootstrap/import 命令，不会由 migration、应用启动或生产部署自动执行。数据库连接读取根目录 `.env`，进程环境变量优先。生产环境如需导入参考目录，必须单独明确执行 seed。

快照位于 `packages/database/seed/catalog.snapshot.json`，金额、展示概率都是十进制字符串，每个对象都有固定 sourceKey。导入在单个事务中执行，仅 sourceKey 冲突表示跳过，其他约束或数据错误整体回滚。已有名称、价格、图片、标签、发布状态等运营修改不会被覆盖；在已存在的盲盒下可以补入尚未存在的初始化物品。结束时输出盲盒和物品的插入／跳过数量。

## Money 与展示概率

`priceMinor`、`displayValueMinor` 为非负 PostgreSQL BIGINT。USD 一单位是 100 cents，COIN 一单位是 1 coin。共享 `@box/money` 通过字符串和 bigint 完成解析、数量乘法、范围校验与展示格式化，不经由 JS 浮点数计算金额，不自动舍入。

API 的 minor units 始终是整数字符串，避免 JSON 数值精度丢失，例如 `{"priceMinor":"699","price":"6.99","priceUnit":"USD"}`。`price` 只是派生的展示字符串；前端计算必须使用 minor units。金币为整数计价，为保持当前样式可显示 `★ 500.00`，尾部 `.00` 不代表支持小数金币。

`CatalogBoxItem.displayProbabilityPercent` 是 nullable NUMERIC，返回十进制字符串或 null。它仅保留参考资料的展示值，不归一化、不推算、不验证合计必须为 100%，前端缺失时显示“展示概率未提供”。未来 Opening Engine 必须采用独立的版本化开奖配置，禁止使用此字段决定开奖结果。

## 公开查询与页面

列表 `GET /catalog/boxes` 接受 `mode=CONSUMER|COIN`、`search`、`minPriceMinor`、`maxPriceMinor`、`category`、`tag=new|hot`、`sort=default|low|high|name`、`page`、`pageSize`。默认消费模式、原展示顺序、第 1 页、每页 60 条，上限 100 条。价格范围针对该模式的单位进行比较。返回 `{boxes,page,pageSize,total}`；非法参数 400，无匹配记录返回空数组。

详情 `GET /catalog/boxes/:slug?mode=CONSUMER|COIN` 返回 `{box,items,relatedBoxes}`，默认消费模式。数据库采用 mode + slug 联合唯一，以保留两种模式的 Pocket Paradise 原有链接；同模式内 slug 不可重复。不存在或未发布为 404；INCOMPLETE 商品仍返回 200 和实际已有物品。推荐由服务端计算：PUBLISHED、相同 mode、排除自身，优先同 category，然后由其他 category 补足，各组按 displayOrder 和稳定 id 排序，最多 6 条。

首页商品、消费目录、金币目录和详情使用 `connection()` 建立请求时渲染边界，并使用 `cache: 'no-store'` 读取 API。详情 metadata 同样在请求时读取。没有目录静态生成或 ISR；修改数据库后刷新即可看到新值。构建只生成代码，不要求 API 或 PostgreSQL 在线。

筛选通过同源 `/api/catalog/boxes` proxy 请求。搜索 300ms 防抖，其他筛选即时执行；请求包含所有筛选和分页条件。输入变更立即取消旧请求并更新请求版本，旧响应无权修改结果、错误或加载状态。失败显示明确的目录服务不可用状态，不回退到本地 JSON。

原前台 JSON 仅作为历史来源快照保留。`decorations.json` 仅含非目录装饰素材；排行榜和 Live Feed 仍是此前的展示内容，不表示实时业务已经实现。

## 验证

使用独立测试 PostgreSQL 和 Redis，先显式迁移和 seed，再运行类型、单元、集成及浏览器测试。CI 已增加显式 seed 步骤。

数据库集成测试覆盖重复导入、运营修改保留、事务回滚、发布状态、精确金额、分页排序、推荐和缺失概率。浏览器运行时测试在原有前台回归完成后执行，使用独立商品 fixture，结束时清理，避免影响原有 36／18 项数量断言。

离线构建需将 DATABASE_URL、REDIS_URL 与 API_INTERNAL_URL 指向不可访问的本地端口后运行 `pnpm build`；该检查不执行迁移或 seed。浏览器另启动 API 不可访问的 Web 实例，验证明确错误而非静态回退。

2026-09-18 本地验收：25 项单元测试、15 项 PostgreSQL／基础设施集成测试、15 项 Playwright 测试通过。格式、lint、严格类型、Prisma 校验和不可访问 API／数据库配置下的构建通过。开发预览已显式导入 54 款盲盒、53 条物品记录；Docker 容器与远程 CI 结果不在本次本机验收声明内。
