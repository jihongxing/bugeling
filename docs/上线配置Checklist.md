# 上线配置 Checklist - 不鸽令 v0.9.0

> 当前上线检查清单，面向已经升级为“同城低成本组局平台 + 底层线下契约引擎”的项目结构。

---

## 一、数据库集合

在云开发控制台 → 数据库 → 手动创建以下集合：

| # | 集合名 | 用途 |
|---|--------|------|
| 1 | `activities` | 活动表 |
| 2 | `participations` | 参与记录表 |
| 3 | `credits` | 用户信用分表（_id = openId） |
| 4 | `transactions` | 资金流水表（押金/退款/分账） |
| 5 | `reports` | 举报记录表 |
| 6 | `activity_reports_summary` | 活动战报摘要表（战报展示、发起同款复用） |
| 7 | `sitemap` | 微信自动生成，无需手动创建 |

创建完成后，将所有集合的权限设置为「仅管理端可读写」（对应 database.rules.json 中的 `.read: false, .write: false`）。

---

## 二、数据库索引

### activities 集合（5 个索引）

| # | 索引字段 | 索引类型 | 使用场景 |
|---|----------|----------|----------|
| 1 | `location` | **2dsphere（地理位置）** | getActivityList — geoNear 聚合查询，LBS 20km 范围活动列表 |
| 2 | `status` + `meetTime` | 复合索引（升序） | 生命周期收敛 — 查询超时活动与详情页补收敛 |
| 3 | `initiatorId` + `meetTime` | 复合索引（升序） | getCalendarActivities — 发起人月度活动查询 |
| 4 | `initiatorId` + `createdAt` | 复合索引（降序） | getMyActivities — 发起人历史活动分页；createActivity — 低信用用户每日限额检查 |
| 5 | `initiatorId` + `status` + `meetTime` | 复合索引 | checkConflict — 发起人待进行活动查询 |

### participations 集合（6 个索引）

| # | 索引字段 | 索引类型 | 使用场景 |
|---|----------|----------|----------|
| 6 | `activityId` + `status` | 复合索引 | 生命周期收敛 — 查询活动参与记录；cancelActivity — 查询需退款的参与者 |
| 7 | `activityId` + `participantId` | 复合索引 | getActivityDetail — 查询调用者参与记录；createDeposit — 重复报名检查 |
| 8 | `participantId` + `createdAt` | 复合索引（降序） | getCalendarActivities — 参与者月度查询；getMyActivities — 参与者历史分页 |
| 9 | `participantId` + `status` | 复合索引 | checkConflict — 参与者待进行活动查询 |
| 10 | `status` + `breachedAt` | 复合索引 | 兼容批处理入口 / 历史数据排查 |
| 11 | `participantId` + `activityId` + `status` | 复合索引 | verifyQrToken — 核销时查询 approved 参与记录；submitReport — 权限校验 |
| 12 | `status` + `needsRefund` | 复合索引 | 兼容批处理入口 / 历史数据排查 |

### transactions 集合（4 个索引）

| # | 索引字段 | 索引类型 | 使用场景 |
|---|----------|----------|----------|
| 12 | `outTradeNo` + `type` | 复合索引 | payCallback — 根据商户订单号查找 deposit 交易 |
| 13 | `participationId` + `type` + `status` | 复合索引 | refundDeposit / splitDeposit — 查找可退款/可分账的 deposit 记录；幂等检查 |
| 14 | `type` + `status` + `createdAt` | 复合索引 | getCalendarActivities — 月度补偿金额查询 |
| 15 | `wxPayOrderId` | 单字段索引 | 支付对账 |

### credits 集合（1 个索引）

| # | 索引字段 | 索引类型 | 使用场景 |
|---|----------|----------|----------|
| 16 | `score` | 单字段索引 | getPosterData — 击败百分比计算（`score < X` 的用户数） |

### reports 集合（1 个索引）

| # | 索引字段 | 索引类型 | 使用场景 |
|---|----------|----------|----------|
| 17 | `activityId` + `status` | 复合索引 | 生命周期收敛 — 检查是否存在待处理举报 |

### activity_reports_summary 集合（1 个索引）

| # | 索引字段 | 索引类型 | 使用场景 |
|---|----------|----------|----------|
| 18 | `activityId` | 单字段索引 | generateActivityReport / createActivityFromReport — 按活动读取或更新战报摘要 |

### 地理位置索引创建方式

```
云开发控制台 → 数据库 → activities → 索引管理 → 添加索引
字段名：location
索引类型：2dsphere
```

---

## 三、环境变量注入检查

### 云函数环境变量（6 个）

所有敏感参数均通过 `config.getEnv()` 从 `process.env` 读取，代码中无硬编码。需在云开发控制台 → 云函数 → 每个云函数的「环境变量」中配置：

| # | 环境变量名 | 来源 | 引用位置 | 状态 |
|---|-----------|------|----------|------|
| 1 | `WX_MCH_ID` | 微信支付商户平台首页 | pay.js → createOrder / refund / splitBill | ✅ 通过 getEnv 注入 |
| 2 | `WX_API_KEY` | 商户平台 → 账户中心 → API安全 | pay.js → 签名生成；payCallback → 签名验证 | ✅ 通过 getEnv 注入 |
| 3 | `WX_API_V3_KEY` | 商户平台 → 账户中心 → API安全 | config.js 中已定义 key，当前代码未直接使用（预留） | ✅ 已定义，待后续使用 |
| 4 | `WX_NOTIFY_URL` | 自行配置的支付回调 URL | createDeposit → 传给 pay.createOrder | ✅ 通过 getEnv 注入 |
| 5 | `JWT_SECRET` | 自行生成 32 位随机字符串 | generateQrToken → JWT 签发；verifyQrToken → JWT 验证 | ✅ 通过 getEnv 注入 |
| 6 | `WX_APPID` | 微信公众平台 → 小程序 AppID | pay.js → 统一下单/退款/分账的 appid 字段 | ✅ 通过 getEnv 注入 |

### 前端生产配置（3 个）

| # | 文件 | 配置项 | 当前状态 |
|---|------|--------|--------|
| 1 | `miniprogram/app.js` | 云开发环境 ID | 已配置为生产云环境 |
| 2 | `project.config.json` | 小程序 AppID | 已配置为生产 AppID |
| 3 | `miniprogram/config/local.private.js` | 腾讯地图 Key | 本地私有配置注入，仓库仅保留 `local.example.js` |

### 商户证书文件（2 个）

需上传至每个涉及退款/分账的云函数的私有目录（`/var/user/`）：

| # | 文件名 | 用途 | 引用位置 |
|---|--------|------|----------|
| 1 | `apiclient_cert.pem` | 商户证书 | pay.js → refund / splitBill |
| 2 | `apiclient_key.pem` | 商户私钥 | pay.js → refund / splitBill |

涉及的云函数：`refundDeposit`、`splitDeposit`、`rejectParticipant`（直接调用 pay.refund）。

### 硬编码 IP 地址（1 处）

`pay.js:137` 中 `spbill_create_ip: '127.0.0.1'` — 微信支付统一下单要求的终端 IP。在云函数环境中无法获取真实客户端 IP，使用 `127.0.0.1` 是云开发场景下的标准做法，无需修改。

---

## 四、云函数部署清单

| # | 云函数名 | 触发方式 | 定时器 |
|---|----------|----------|--------|
| 1 | createActivity | 用户调用 | — |
| 2 | getActivityList | 用户调用 | — |
| 3 | getActivityDetail | 用户调用 | — |
| 4 | approveParticipant | 用户调用 | — |
| 5 | rejectParticipant | 用户调用 | — |
| 6 | createDeposit | 用户调用 | — |
| 7 | payCallback | 微信回调 | — |
| 8 | refundDeposit | 内部调用 | — |
| 9 | splitDeposit | 内部调用 | — |
| 10 | generateQrToken | 用户调用 | — |
| 11 | verifyQrToken | 用户调用 | — |
| 12 | reportArrival | 用户调用 | — |
| 13 | autoArbitrate | 兼容入口 / 手动调用 | — |
| 14 | executeSplit | 兼容入口 / 手动调用 | — |
| 15 | getCreditInfo | 用户调用 | — |
| 16 | getMyActivities | 用户调用 | — |
| 17 | submitReport | 用户调用 | — |
| 18 | checkTextSafety | 内部调用 | — |
| 19 | checkImageSafety | 内部调用 | — |
| 20 | getCalendarActivities | 用户调用 | — |
| 21 | checkConflict | 用户调用 | — |
| 22 | getPosterData | 用户调用 | — |
| 23 | cancelActivity | 用户调用 | — |
| 24 | manualVerify | 用户调用 | — |
| 25 | processVerifiedRefunds | 兼容入口 / 手动调用 | — |
| 26 | generateActivityReport | 用户调用 | — |
| 27 | createActivityFromReport | 用户调用 | — |

---

## 五、生命周期收敛配置

当前版本已经移除高频定时触发器，不再部署以下 `config.json`：

- `cloudfunctions/autoArbitrate/config.json`
- `cloudfunctions/executeSplit/config.json`
- `cloudfunctions/processVerifiedRefunds/config.json`
- `cloudfunctions/autoLockActivities/config.json`

请确认以下事实：

- `cloudfunctions/_shared/activityLifecycle.js` 已随云函数一起上传
- `getActivityDetail`、`approveParticipant`、`payCallback`、`reportArrival`、`verifyQrToken`、`manualVerify` 已上传最新版本
- 云开发控制台中没有残留旧 timer

---

## 六、微信支付商户平台配置

- [ ] 开通「分账」功能（产品中心）
- [ ] 添加分账接收方：平台商户账户（接收 30%）
- [ ] 配置支付回调 URL（与 `WX_NOTIFY_URL` 环境变量一致）
- [ ] 下载商户证书并上传至云函数私有目录

---

## 七、微信小程序后台配置

- [ ] 设置基础库最低版本为 `2.9.0+`（Canvas 2D API 依赖）
- [ ] 配置服务器域名白名单：`api.mch.weixin.qq.com`（微信支付）
- [ ] 确认 `scope.userLocation` 权限描述已在 app.json 中声明

---

## 八、数据库安全规则

将 `database.rules.json` 的规则应用到云开发控制台：

```json
{
  "activities":      { ".read": false, ".write": false },
  "participations":  { ".read": false, ".write": false },
  "credits":         { ".read": false, ".write": false },
  "transactions":    { ".read": false, ".write": false },
  "reports":         { ".read": false, ".write": false },
  "activity_reports_summary": { ".read": false, ".write": false }
}
```

前端无任何直接数据库操作（已验证），所有读写均通过云函数执行。

---

## 九、战报与同款复用增量部署清单

- [ ] 创建 `activity_reports_summary` 集合
- [ ] 为 `activity_reports_summary.activityId` 创建单字段索引
- [ ] 将 `database.rules.json` 中的 `activity_reports_summary` 规则同步到云开发控制台
- [ ] 上传并部署 `generateActivityReport`
- [ ] 上传并部署 `createActivityFromReport`
- [ ] 确认这两个云函数无需额外环境变量、无需定时触发器
- [ ] 确认小程序战报页已包含“发起同款”按钮，并且页面代码已发布到体验版或开发版

## 十、战报与同款复用手工验收路径

建议在开发环境按下面这条链路验收一次：

1. 先准备一条可展示战报的活动数据：活动需存在 `templateType`、`budgetType`、`serviceFee`、`bondAmount`、`minParticipants`、`maxParticipants`、`meetingPointText`，并且至少有 1 条参与记录。
2. 在微信开发者工具上传并部署 `generateActivityReport` 和 `createActivityFromReport`，选择“云端安装依赖”。
3. 打开小程序开发版，进入“我的历史活动”或活动详情页，点击“查看活动战报”。
4. 首次打开战报页后，到云开发控制台检查 `activity_reports_summary`：
   应新增或更新一条 `activityId = 当前活动 ID` 的摘要记录，且包含 `title`、`templateType`、`participantCount`、`meetingPointText`、`serviceFee`、`bondAmount`、`reportId/_id` 等字段。
5. 在战报页点击“发起同款”。
6. 确认已跳转到创建页，且以下字段已自动带入：模板类型、标题、一句话说明、预算类型、服务费、保证金、最低成局人数、人数上限、集合说明、安全相关开关。
7. 手动补充新的时间和地点后发布活动。
8. 到云开发控制台检查新生成的 `activities` 记录：
   `sourceReportId` 应等于战报摘要的 `_id/reportId`，并且 `templateType`、`budgetType`、`serviceFee`、`bondAmount`、`meetingPointText` 与战报 seed 保持一致。
9. 如需补充验证，再次打开新活动详情页和战报页，确认旧活动战报可重复复用，新活动本身不受影响。
