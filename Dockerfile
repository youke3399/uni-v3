FROM node:latest

WORKDIR /usr/src/app

COPY . .

# 启用并配置 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 安装依赖并构建
RUN pnpm install
RUN pnpm build

# 启动应用
CMD ["pnpm", "start"]
