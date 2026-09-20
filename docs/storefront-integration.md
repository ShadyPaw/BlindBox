# 独立 H5 与现有后端联调

本轮复用 NestJS/Fastify、PostgreSQL/Prisma 和现有认证，不迁移仓库、不改认证模型。前端为 BlindBoxTest/BindBoxH5，不能用本仓库旧 apps/web 的通过结果替代独立 H5 验收。

## 接口状态

| 接口                                                               | 实现状态          | 契约                                                                              |
| ------------------------------------------------------------------ | ----------------- | --------------------------------------------------------------------------------- |
| GET /catalog/boxes                                                 | 已有实现          | mode、search、minor units 价格、category、tag、sort、page、pageSize；仅 PUBLISHED |
| GET /catalog/boxes/:slug?mode=...                                  | 已有实现          | box/items/relatedBoxes；mode+slug 联合标识；推荐最多 6 条                         |
| /auth/register、login、me、logout、forgot-password、reset-password | 已有实现          | 沿用 Cookie 会话、Origin/CSRF 和限流；不增加认证协议                              |
| GET /storefront/home                                               | 本轮新增，只读 v1 | featuredBoxes、hotBoxes、banners、featuredCompetitionId                           |
| /storefront/live-drops、/rewards/_、/leaderboards/_                | 未实现            | H5 草案与开发 Mock 不代表后端可用                                                 |
| 福利领取、开奖、支付                                               | 本轮不实现        | 不伪造交易或发奖成功                                                              |

首页两组引用只选择 PUBLISHED / CONSUMER / USD 商品，均最多 6 项。精选按 displayOrder、稳定 id 升序。热门优先 hot 标签，各组按同样顺序，不足时用非 hot 商品补齐且不重复；这是展示顺序，不是销量榜。返回空 banners 与 null featuredCompetitionId，不补造活动。无商品返回合法空数组，数据库错误返回 503，所有响应 no-store。

Catalog 金额为 BIGINT / bigint，JSON minor units 为字符串。displayProbabilityPercent 仅展示、可空、不归一化，不能作为开奖配置。不存在或未发布返回 404；INCOMPLETE 仍为 200。未来 Opening Engine 独立建模。

## 可复现验收

1. 准备独立 PostgreSQL 测试数据库和 Redis，配置 DATABASE_URL、REDIS_URL；不能指向生产。
2. pnpm install --frozen-lockfile；pnpm db:deploy；显式执行 pnpm db:seed:catalog。应用启动与生产迁移不自动 seed。
3. 在独立 H5 仓库安装依赖并执行 pnpm build。构建时 API_INTERNAL_URL 可设为 http://127.0.0.1:9。
4. 本仓库执行 pnpm build，设置 H5_REPOSITORY_PATH 为独立 H5 绝对路径，再执行 pnpm test:h5。Windows 可设置 PLAYWRIGHT_CHANNEL=chrome。
5. 测试自动使用 API 3202、H5 3200、故障验证 H5 3204；不复用已有服务。准备阶段显式 seed，测试自身只创建带唯一标识的临时商品和用户并清理。

联调覆盖首页→详情、两种目录、同名 slug、推荐、搜索/排序/分页、INCOMPLETE、未发布 404、故障无 fallback，以及注册、刷新会话、退出、再次登录。直接修改 PostgreSQL 中 Box A 的名称和价格，刷新首页、目录与详情必须显示最新值。

pnpm test:integration 保留真实 PostgreSQL seed 幂等/运营修改保护/回滚、认证和钱包既有回归；本轮没有新增资金业务。H5 原有测试继续覆盖竞态和 Mock 展示状态。真实测试结果与 Mock 结果分开记录。CI 中常规后端检查不声称自动完成跨私有仓库联调；test:h5 需显式提供独立前端 checkout。

## 剩余工作

福利、榜单、实时掉落业务后端仍未实现。原站视觉对照、缺失商品明细、支付渠道、真实奖池、背包及运营能力继续按原阶段推进。本文件是代码核对结果，不冒称伙伴已经批准所有产品规则。

## 本轮本地验证记录

2026-09-20：后端 format:check、lint、typecheck、33 项单元、27 项 PostgreSQL 集成、不可达 API/数据库/Redis 条件下构建、21 项原工程 E2E 通过。独立 H5 提交 68085a8 的 4 项真实联调全部通过；H5 自身 39 项单元、15 项常规浏览器回归和离线构建通过。原工程 E2E 与独立 H5 联调分别计数。测试可见 Next 导航中断日志，但断言全部通过，不宣称无日志告警。
