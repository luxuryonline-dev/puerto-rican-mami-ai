# Puerto Rican Mami AI

puertoricanmamiai.com 的独立仓库，基于 MIT 许可的 Shipwords：https://github.com/shipwords-dev/shipwords

应用位于 sites/puerto-rican-mami-ai，packages/core 和 packages/jobs 提供登录、积分、支付与生成任务生命周期。本仓库不包含 Tiny Desk 站点。

使用 Node.js 24 和 pnpm 10。先执行 pnpm install，再运行 node sites/puerto-rican-mami-ai/scripts/setup-local.mjs 准备开发密钥，并执行本站本地数据库迁移。随后在仓库根目录运行 pnpm dev 或 pnpm build。

Cloudflare 新 Worker 连接本仓库后，使用 main 分支、根目录 /、Node 24，构建命令 pnpm build、部署命令 pnpm run deploy。先配置资源、邮件与运行密钥；详见 sites/puerto-rican-mami-ai/DEPLOY.zh-CN.md。

不上传旧站群锁文件。首次 pnpm install 生成独立仓库的锁文件，.npmrc 允许 CI 初次安装生成它；之后应提交生成的锁文件并开启 frozen 安装。

正式域名和独立 D1 ID 已配置。原应用已通过本地类型检查、构建、站点检查和模拟 API 集成测试。新仓库全新依赖安装/构建及生产发布尚未验证；真实模型效果、成本和正式支付尚未验收。本地 mock 原样返回参考视频，没有 live 支付密钥时付款关闭。
