# 策略看板

## 目录结构

```text
frontend/                 前端源码
backend/                  后端源码
backend/src/main/resources/db/
                          MySQL 建表脚本和演示数据脚本
.cache/                   本机依赖缓存，自动生成，不提交
.runtime/                 本机运行目录，自动生成，不提交
```

生成物和缓存不放在源码目录里：
- `frontend/node_modules/`：前端依赖目录，由 `npm ci` 生成，不提交。
- `frontend/dist/`：前端构建产物，由 `npm run build` 生成，不提交。
- `backend/target/`：后端 Maven 构建产物，不提交。
- `.cache/maven/`：Maven 依赖缓存，不提交。
- `.runtime/`：运行时 jar、日志等本机文件，不提交。

## 启动

Windows 环境下，在仓库根目录运行：

```powershell
.\start-all.ps1
```

或：

```bat
start-all.bat
```

脚本会安装依赖、构建前端、打包后端，并启动服务。

启动成功后访问：

- 主页：`http://localhost:28637`
- 设计页：`http://localhost:28637/#/designer`

## 运行准备

请确认本机已安装并加入 `PATH`：
- Node.js 18+
- Maven 3.9+
- Java 17+
- MySQL 8+

## MySQL

- 默认连接：`jdbc:mysql://localhost:3306/strategy_dashboard`。
- 默认账号：`root`，默认密码：`root`。
- 如需修改，在启动前设置 `STRATEGY_DB_URL`、`STRATEGY_DB_USERNAME`、`STRATEGY_DB_PASSWORD`。
- `backend/src/main/resources/db/schema-mysql.sql` 保存表结构。
- `backend/src/main/resources/db/data-mysql.sql` 保存演示图表、策略、指标、模板和示例业务表数据。
- 启动时会执行 SQL 初始化，数据写入使用主键/唯一键 upsert，重复启动不会重复插入演示数据。

示例：

```powershell
$env:STRATEGY_DB_USERNAME="root"
$env:STRATEGY_DB_PASSWORD="your_password"
.\start-all.ps1
```

## 智能体

- 默认读取环境变量 `DEEPSEEK_API_KEY`。
- 未配置 Key 时，系统会使用本地 fallback 逻辑，不影响演示。

```powershell
$env:DEEPSEEK_API_KEY="your_api_key"
.\start-all.ps1
```
