# 认证服务

本阶段实现邮箱与密码注册、登录、当前账户、退出和一次性密码重置。账户页是功能页，并非原站完整个人中心的还原。

## 启动

先执行 `pnpm dev:setup`、`pnpm infra:up`、`pnpm db:deploy`，再执行 `pnpm dev`。旧 `.env` 不会被自动覆盖，请对照 `.env.example` 补充认证和邮件配置。Web 默认访问 `http://127.0.0.1:3002`，可通过应用级环境变量 `API_INTERNAL_URL` 修改。

本地使用 `MAIL_TRANSPORT=file`，API 工作目录下默认 `../../.local/mail` 保存重置邮件 JSON，其中的 `url` 可在浏览器打开。文件包含有效重置凭据，不应共享或提交。生产环境禁止 file 模式，需配置 SMTP；disabled 模式会明确拒绝找回密码请求。真实 SMTP 投递尚需部署时验证。

## 接口

| 方法 | API 路径              | 用途                           |
| ---- | --------------------- | ------------------------------ |
| POST | /auth/register        | 注册并创建会话                 |
| POST | /auth/login           | 登录并更换当前会话             |
| GET  | /auth/me              | 当前用户基本资料               |
| POST | /auth/logout          | 删除当前会话                   |
| POST | /auth/forgot-password | 请求重置邮件                   |
| POST | /auth/reset-password  | 消费一次性令牌并撤销所有旧会话 |
| GET  | /auth/admin/session   | 管理员权限边界检查             |

浏览器通过同源 `/api/auth/*` 代理访问；写请求需要允许的 Origin、JSON 内容类型和 `X-Box-CSRF: 1`。用户角色固定为 USER，接口不接受客户端指定角色。ADMIN 仅允许受控数据库运维赋予，目前没有管理员业务界面。

## 安全与范围

密码使用带独立随机盐的 scrypt，长度 15–128 字符。会话令牌和重置令牌为 256 位随机值，数据库只保存摘要。会话使用 HttpOnly、SameSite=Lax Cookie，生产强制 Secure；默认有效期 7 天。重置令牌 30 分钟有效，事务保证并发消费只有一次成功。

Redis 限流同时覆盖动作来源和邮箱；当前 Web 代理使 API 看到代理地址，因此 IP 配额由经过该代理的用户共享。规模化部署前需设计可信代理边界和真实客户端 IP 传递，不能直接信任任意客户端的转发头。

重置请求对存在／不存在的邮箱返回相同正文，但邮件投递耗时可能不同；尚未实现完整的时间侧信道防护。邮件验证、MFA、短信、OAuth、设备管理和完整风控均未实现。注册邮箱不能视为已验证邮箱，资产业务接入前必须补齐验证要求。

## 测试

使用独立 PostgreSQL 测试数据库及 Redis 实例。先设置 `DATABASE_URL`、`REDIS_URL`，执行 `pnpm db:deploy`。然后执行 `pnpm check` 和 `pnpm test:integration`。浏览器测试会启动 3100、3101、3102 端口的服务，重置邮件输出到 `.local/test-mail`，测试账户在结束时清理。Windows 可设置 `PLAYWRIGHT_CHANNEL=chrome` 使用已安装的 Chrome。

数据库集成测试覆盖非法输入、CSRF、权限、限流、会话撤销、过期及并发重置；浏览器测试覆盖注册、账户页刷新、退出、重置和重新登录。不要对生产数据库执行这些测试。
