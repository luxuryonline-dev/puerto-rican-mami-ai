# Puerto Rican Mami AI 部署

正式域名：`puertoricanmamiai.com`。本地类型检查、生产构建、站点检查已通过；网站尚未上线，真实 AI 生成与支付尚未验收。

独立 D1 已创建：`49c8b2d0-007d-41f2-821b-bd07521d8294`。R2、远程迁移、邮件与生产密钥仍需配置。不要复用 Tiny Desk 的数据库、存储或密钥。

## 在自己的 PowerShell 中执行

打开 PowerShell，进入仓库根目录。使用 Node.js 24 和 pnpm 10。

```powershell
cd 'C:\Users\lhzhl\Documents\Codex\2026-10-30\new-chat\puerto-rican-mami-ai'
$env:Path = 'C:\Users\lhzhl\Documents\Codex\2026-10-29\new-chat\work\tools\node-v24.22.2-win-x64;' + $env:Path
pnpm install --no-frozen-lockfile
cd sites\puerto-rican-mami-ai
pnpm exec wrangler login --device
pnpm exec wrangler whoami
```

按终端显示的地址和代码授权。`whoami` 应显示目标 Cloudflare 账户。网页已登录与部署工具已授权是两件事，不要在聊天中发送密码或 API 密钥。

新站的 lockfile importer 尚待联网运行上述 `pnpm install` 自动生成；生成后提交 `pnpm-lock.yaml`。不要手改锁文件，也不要把当前分支直接当作已通过 frozen-lockfile 安装的生产版本。

## 第一次发布所需资源

以下命令在站点目录执行。任何一步报错先停止处理；R2 已存在时不重复创建。

```powershell
$env:CLOUDFLARE_ACCOUNT_ID = 'a18a082313f9d93251d07fbacdfe60e1'
pnpm exec wrangler r2 bucket create puerto-rican-mami-ai-outputs
pnpm db:migrate:remote
pnpm exec wrangler email sending enable puertoricanmamiai.com
```

按照邮件开通提示完成域名验证，并核验 `noreply@puertoricanmamiai.com` 发信、`support@puertoricanmamiai.com` 收信。配置上传素材生命周期规则，保留时间应与隐私政策一致。

生成独立的登录与访客密钥，直接通过标准输入交给 Wrangler：

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))" | pnpm exec wrangler secret put BETTER_AUTH_SECRET
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))" | pnpm exec wrangler secret put GUEST_COOKIE_SECRET
pnpm exec wrangler secret put YIR_API_KEY
```

最后一项在终端交互输入真实上游密钥。其他可选登录、反滥用与支付配置参考仓库 `docs/site-launch.md`。不把 `.dev.vars` 上传为生产配置。真实模型效果和成本验收完成前，不配置 Stripe live key；站点会保持付款关闭。

生产发布从 `main` 运行：

```powershell
pnpm check
pnpm run deploy
```

Wrangler 会根据 `wrangler.jsonc` 配置 Worker、独立 Workflow 和正式域名路由。成功后还需验收首页、邮件登录、上传、真实生成、下载和退款；命令成功不等于 AI 效果已验证。

## GitHub / Workers Builds

与 Tiny Desk 一样，可以让新建的 Cloudflare Worker 连接 `luxuryonline-dev/puerto-rican-mami-ai`，只构建本目录。先生成并提交新站锁文件，再合并到 `main`。使用 Node 24、仓库根目录，构建命令 `pnpm --filter ./sites/puerto-rican-mami-ai check`，部署命令 `pnpm --filter ./sites/puerto-rican-mami-ai run deploy`。资源、邮件与密钥仍需先完成配置。

这是新 Worker 的配置，不要修改 Tiny Desk 已有 Worker 的构建设置。
