# 投研 BI 看板系统

## 一键启动
Windows 环境下，拉取代码后直接在仓库根目录执行：

```powershell
.\start-all.ps1
```

或者：

```bat
start-all.bat
```

脚本会自动完成这些事情：

1. 首次安装前端依赖
2. 构建前端
3. 把前端构建产物复制到后端静态目录
4. 打包后端
5. 从数据库模板初始化运行库
6. 启动 Spring Boot 服务

启动成功后访问：

- 首页：`http://localhost:28637`
- 设计页：`http://localhost:28637/#/designer`
- H2 控制台：`http://localhost:28637/h2-console`

## 运行前准备
请确保本机已安装并加入 `PATH`：

- Node.js 18+
- Maven 3.9+
- Java 17+

## 仓库结构说明

### 前端构建产物
- 前端源码在 `frontend/`
- 前端构建输出在 `frontend/dist/`
- 打包前会复制到 `backend/src/main/resources/static/`
- `backend/src/main/resources/static/` 下的构建产物不再纳入 Git 跟踪，避免不同设备一构建就冲突

### 数据库模板与运行库
- 演示数据库模板保存在 `backend/data-template/bi-demo.mv.db`
- 实际运行数据库保存在 `backend/runtime/data/bi-demo.mv.db`
- 首次启动时会自动从模板复制到运行目录
- 运行中的数据库文件不纳入 Git 跟踪，避免一启动项目就把仓库弄脏

这意味着：

- 另一台设备 `git pull` 后仍然可以直接启动
- 启动和编译不会再直接修改 Git 跟踪的数据库文件
- 前端重新构建也不会再因为静态资源产物导致 `git pull` 冲突

## TKF 智能体说明
- 默认读取环境变量 `DEEPSEEK_API_KEY`
- 如果没有配置 API Key，系统仍可正常启动
- 未配置 Key 时，TKF 智能体会自动走本地 fallback 演示逻辑，不影响演示

如需启用 DeepSeek，可在启动前设置：

```powershell
$env:DEEPSEEK_API_KEY="your_api_key"
.\start-all.ps1
```
