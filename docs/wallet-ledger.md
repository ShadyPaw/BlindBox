# Phase 4：最小钱包后端

2026-09-19：完成 USD／COIN 独立余额、不可变双分录流水、内部入账／扣款、事务组合、幂等、并发防超扣、认证查询与只读对账。本阶段不实现支付、开奖、冻结、提现、兑换、用户转账或管理员加款接口。`/wallet` 页面仍是明确标记的演示；真实查询接口已经独立提供，尚未替换演示页面的数据层。

## 存储与资金规则

- `WalletAccount`：每用户每币种唯一；余额为 PostgreSQL BIGINT，用户余额不得小于零。老用户无需回填，未建立账户时查询返回真实的初始余额 0，第一次内部记账才在事务内创建零余额账户。
- `WalletTransfer`：一条不可变记录代表同币种、同金额的一对借贷，保存来源账户、目标账户、金额、方向、业务引用、幂等键、请求摘要与两侧记账后余额。源账户减少、目标账户增加，每笔净变动为零。
- 每币种有一个内部 CLEARING 对应账户，可以为负。它只是账本的对应科目，**不是第三方已收款的证明，也不是可供用户消费的资金账户**。本版按币种共用它，会串行化该币种的写入；正确性优先，后续按测得吞吐设计扩展。
- 金额输入为规范非负整数字符串，入账／扣款必须严格大于零；业务使用 bigint，数据库使用 BIGINT，JSON 返回字符串。禁止浮点、隐式舍入、负数及越界；COIN 与 USD 不互兑。
- SQL 触发器按账户 ID 固定顺序加行锁、校验币种／方向／余额／范围，并计算余额快照。余额仅在流水实际 INSERT 成功后的触发器中更新；包括 `ON CONFLICT DO NOTHING` 在内的跳过插入不会偷偷改余额。
- 数据库拒绝流水 UPDATE／DELETE／TRUNCATE、账户身份变更和直接余额写入，用户外键为 RESTRICT；有财务历史的用户不能直接删除。错误只能由后续受控业务创建新的补偿记录，不修改历史。

## 可用 API

必须带现有有效 session cookie；只允许查询当前用户，不接受 `userId`。用户 A 不能读取用户 B。Web 同源入口是 `/api/wallet/balances` 和 `/api/wallet/transactions`。

### `GET /wallet/balances`

```json
{
  "balances": [
    { "unit": "USD", "availableMinor": "699" },
    { "unit": "COIN", "availableMinor": "0" }
  ]
}
```

没有冻结能力，因此真实契约不返回假的冻结余额；它与 UI 原型契约分开，类型名为 `WalletBalancesResponse`。

### `GET /wallet/transactions?unit=USD&direction=DEBIT&pageSize=20&cursor=123`

- 默认 USD、全部方向、20 条；pageSize 为 1–100，direction 可选 CREDIT／DEBIT，cursor 是正整数序号字符串。
- 按全局唯一 sequence 倒序执行游标分页。sequence 不是连续号码，回滚会留下间隙；分页不是跨请求的数据库快照，新入账需要刷新第一页。
- 返回 `{ transactions, nextCursor }`；没有更多记录时 nextCursor 为 null。每条包含 `id / unit / direction / amountMinor / balanceAfterMinor / referenceType / referenceId / description / createdAt`。
- 仅展示用户一侧，不暴露系统账户余额、其他用户、幂等键或请求摘要。
- 未登录／会话过期为 401，非法筛选为 400，服务故障为 503；全部 `Cache-Control: no-store`。没有任何充值、扣款或修改余额 HTTP 端点；Web proxy 也只支持 GET。

## 后端记账接口与 Phase 5 衔接

`WalletLedgerService` 提供 `credit / debit / creditInTransaction / debitInTransaction`。API 已注册内部 `WALLET_LEDGER` provider，没有公开写 controller。

```ts
const input = {
  userId,
  unit: 'USD' as const,
  amountMinor: '699',
  idempotencyKey: 'opening:operation-id:debit',
  referenceType: 'OPENING',
  referenceId: 'operation-id',
  description: 'Opening debit',
};

// Standalone internal posting opens and commits its own transaction.
const entry = await ledger.debit(input);

// Future Phase 5 only: use the SAME transaction as the business record.
await db.$transaction(async (tx) => {
  // Claim the unique opening operation and return its persisted result on replay.
  const debit = await ledger.debitInTransaction(tx, input);
  // Persist that operation's outcome in tx, referencing debit.id.
  // This documentation does not implement an Opening Engine or any outcome table.
});
```

以上两段是两种调用方式，业务只能选择其中一种；禁止先调用独立 debit 提交扣款，再另开事务保存结果。外层业务需要使用 ReadCommitted（本版默认），并传播全部错误以回滚整个事务；多笔记账需按稳定业务键顺序调用。

幂等键在整个账本全局唯一。相同键和规范化请求返回原记录及原记账后余额，不重复记账；变更用户、币种、方向、金额、引用或描述会产生 `IDEMPOTENCY_CONFLICT`。另有 `(referenceType, referenceId, direction)` 唯一约束，换幂等键重放同一业务返回 `REFERENCE_CONFLICT`。业务引用必须在该类型下全局唯一，不能直接使用用户内局部编号。

失败事务不会留下流水或占用幂等键，余额不足后可在条件改变时重新提交。连接超时／提交结果不明时必须使用**相同键和请求**重试，不能换键。基础设施错误不会被伪装成余额不足；调用方如重试死锁，应重试整个业务事务，不只重试扣款。内部业务错误代码：`INVALID_POSTING / USER_NOT_FOUND / IDEMPOTENCY_CONFLICT / REFERENCE_CONFLICT / INSUFFICIENT_FUNDS / AMOUNT_OVERFLOW`。

**钱包扣款幂等不等于开奖幂等。** Phase 5 必须另行保证唯一开箱操作、已存结果重放、独立版本化奖池和开奖结果持久化，不能因钱包返回了旧扣款而再抽一次。不得使用 Catalog 的展示概率开奖。外层事务的业务成功日志应在外层提交后记录；独立记账方法会在提交后输出结构化确认日志（可能是幂等重放）。

内部 credit 只供将来经过验证和授权的资金来源调用。系统没有公开测试加钱命令，也不会在注册、启动、迁移、seed 或部署时赠送余额。支付回调验签、金额核验、订单归属与入账资格属于后续 Phase 8。

## 迁移、对账与部署边界

```sh
pnpm db:deploy
pnpm build
pnpm wallet:reconcile
```

`202609190001_wallet` 只新增 schema 和完整性约束，不创建资金或导入业务记录。启动新版 API 前先执行迁移。`wallet:reconcile` 读取一个一致性快照，对比账户余额与不可变流水汇总，输出 JSON；差异时退出码为 1，不会修复或调整任何金额。命令依赖已构建的共享包和 API。

清算账户也是有界 BIGINT，不是无限资金池；达到任一侧边界时拒绝操作。正式环境应分离应用数据库角色与迁移角色：应用不得有 DDL、禁用触发器、改变 replication role 等权限。超级用户／表所有者可绕过数据库保护，本轮本地开发账户不能视作生产权限验收。

资金历史存在后不得直接回滚删除钱包表；优先前滚修复，回滚 API 时保留账本及备份。生产备份恢复、监控报警、真实渠道对账和负载容量尚需上线前专项验收。

## 验证范围

- 单元：正整数金额、BIGINT 边界、非法文本不抛转换异常、必填业务引用、分页、参数注入、生产 session cookie 规则。
- PostgreSQL：零余额且不自动建账、超 JS 安全整数金额、币种隔离、并发幂等、请求冲突、业务引用冲突、8 个并发扣款不超扣、外层业务失败回滚、失败键可重试、溢出拒绝、流水与余额保护、SQL 跳过插入不记账、跨币种拒绝、所有权／分页／会话／写接口边界，以及余额对账。
- 浏览器测试：真实认证通过同源 proxy 读取余额与流水，退出后禁止读取、无写入口、API 故障不返回原型数据；保留全部认证、Catalog 和钱包原型回归。
- 集成测试只在隔离测试数据库运行。有流水的 `wallet-test-*` 审计夹具故意保留，不为清理测试而禁用不可变约束；临时 session 和无账本用户会清理。需要清空时重建专用测试数据库，不操作开发或生产数据。
