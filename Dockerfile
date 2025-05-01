FROM node:latest

WORKDIR /usr/src/app

COPY . .

# 启用并配置 pnpm
RUN npm install -g pnpm

# 安装依赖并构建
RUN pnpm install
RUN pnpm build

# 启动应用
CMD ["pnpm", "start"]
