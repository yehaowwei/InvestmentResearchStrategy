# 投研 BI 看板系统

## 目录

- `backend`：Spring Boot 3 / Java 17 后端
- `frontend`：React / Vite / Ant Design 前端

## 启动

### 后端

```powershell
cd backend
mvn spring-boot:run
```

### 前端

```powershell
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

## 地址

- 设计态：`http://localhost:8080/#/designer`
- 运行态：`http://localhost:8080/#/runtime/volatility_tracking_dashboard`
- 后端 API：`http://localhost:8080/api`

## 设计态流程

设计态围绕数据池配置图表：先选择或新建数据池，再选择预设模板，然后配置维度、系列拆分字段、指标、筛选排序和通用展示设置。数据池支持单表来源，也预留多表查询配置；数据池内可以继续添加计算指标，例如平均值、滚动三年平均值。
