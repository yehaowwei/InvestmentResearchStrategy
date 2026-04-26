# 投研 BI 看板系统

## 一键启动

Windows 环境下，拉取代码后直接运行仓库根目录的以下任一命令即可：

```powershell
.\start-all.ps1
```

或：

```bat
start-all.bat
```

脚本会自动完成这些事情：

1. 安装前端依赖（首次启动时）
2. 构建前端
3. 打包后端
4. 启动 Spring Boot 服务

启动成功后访问：

- 主页：`http://localhost:28637`
- 设计页：`http://localhost:28637/#/designer`
- H2 控制台：`http://localhost:28637/h2-console`

## 运行前准备

请确保本机已安装并加入 `PATH`：

- Node.js 18+
- Maven 3.9+
- Java 17+

## 数据说明

- 演示数据直接保存在仓库内的 `backend/data/bi-demo.mv.db`
- 不依赖额外 SQL 导入
- 另一台设备 `git pull` 后可直接启动

## TKF 智能体说明

- 默认读取环境变量 `DEEPSEEK_API_KEY`
- 如果没有配置 API Key，系统仍可正常启动
- 未配置 Key 时，TKF 智能体会自动走本地 fallback 演示逻辑，不影响演示

如需启用 DeepSeek，可在启动前设置：

```powershell
$env:DEEPSEEK_API_KEY="your_api_key"
.\start-all.ps1
```
