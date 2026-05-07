# 实施计划：不鸽令 UGC 组局化改造

> 当前融合实施主文档。用于说明如何把原有线下契约引擎升级成“表层同城低成本组局平台 + 底层履约引擎”的结构。

## 1. 文档目的

本文档用于将 [UGC 同城低成本组局小程序](./UGC%20同城低成本组局小程序.md) 的产品方案，与当前 `BugeLing / 不鸽令` 项目的既有能力进行融合，输出一份可直接执行的实施计划。

目标不是重做一个新项目，而是在现有“押金履约引擎”基础上，升级为“模板化同城低成本组局平台”。

---

## 2. 现状判断

## 2.1 当前项目已经具备的核心能力

当前项目已经完成以下关键基础设施，这些能力应尽量复用：

- LBS 附近活动列表与 POI 选点
- 活动创建、详情、管理页基础框架
- 押金支付、退款、分账流水
- 信用分系统与访问限制
- 内容安全审核与举报流程
- 到场上报、自动仲裁、手动确认到场
- 活动日历、冲突检测、海报能力

对应现有代码基础：

- 前端页面：`miniprogram/pages/index`、`miniprogram/pages/activity/*`、`miniprogram/pages/user/*`
- 活动相关云函数：`createActivity`、`getActivityList`、`getActivityDetail`
- 支付相关云函数：`createDeposit`、`payCallback`、`refundDeposit`、`splitDeposit`
- 履约相关云函数：`reportArrival`、`verifyQrToken`、`manualVerify`、`autoArbitrate`

## 2.2 当前项目与 UGC 方案的核心差异

当前项目偏“线下约见契约工具”，UGC 方案偏“模板化多人组局平台”。两者差异主要体现在：

| 维度 | 当前项目 | UGC 目标 |
|---|---|---|
| 供给模式 | 用户手写活动 | 模板化发局 |
| 履约模式 | 押金报名 + 发起人审批 + 扫码核销 | 服务费 + 保证金 + 自动成局 + 定位签到 |
| 组局规模 | 偏小规模约见 | 2-8 人轻量组局 |
| 状态机 | `pending/confirmed/verified/expired` | 招募中/已成局/已锁局/进行中/已结束 |
| 社交方式 | 解锁微信号，线下见面 | 活动驱动，弱化私聊，避免泛社交 |
| 增长闭环 | 履约完成 | 活动战报 + 发起同款 |

## 2.3 产品融合后的新定位

建议将产品定位升级为：

> 基于押金履约和信用体系的同城低成本组局小程序

底层仍然是 `不鸽令` 的履约与风控引擎；上层升级为：

- 模板发起
- 附近分发
- 自动成局
- 定位签到
- 评价信用
- 战报复用

---

## 3. 融合原则

实施时遵循以下原则：

1. 不重做底层支付、信用、LBS、举报、日历能力。
2. 第一阶段不做完整陌生人聊天系统，避免产品偏向泛社交。
3. MVP 优先把“模板发起 -> 报名支付 -> 成局 -> 签到 -> 评价 -> 战报 -> 同款复用”闭环跑通。
4. 对现有功能优先做语义升级，而不是完全推翻重写。
5. 设计上优先支持 2-8 人、公共空间、低预算、弱关系场景。
6. 风控优先级高于增长优先级，宁可慢一点，也不要引入高风险场景。

---

## 4. 总体实施策略

## 4.1 总策略

不建议直接在当前代码上零散打补丁，而是按以下顺序推进：

1. 先升级数据模型与状态机。
2. 再升级发起页、首页卡片、详情页，使 UGC 结构能展示出来。
3. 再改支付与成局逻辑，把“押金工具”改成“组局机制”。
4. 最后补签到、评价、战报和同款复用，形成增长闭环。

## 4.2 推荐实施阶段

建议拆为 6 个阶段：

1. Phase 0：方案冻结与数据模型改造
2. Phase 1：模板发起与活动流升级
3. Phase 2：报名支付与自动成局改造
4. Phase 3：签到、评价、信用升级
5. Phase 4：战报、一键同款、推荐排序
6. Phase 5：运营后台、风控补强、灰度上线

---

## 5. MVP 范围定义

## 5.1 本次改造的 MVP 必做项

- 模板选择发起活动
- 首页活动流结构化展示
- 时间、距离、预算、类型、安全筛选
- 报名支付：服务费 + 保证金
- 最低成局人数 + 自动成局
- 活动签到：定位签到为主，发起人确认为辅
- 活动结束互评
- 信用信息扩充
- 活动战报生成
- 从战报发起同款

## 5.2 本次改造暂不做

- 完整 IM 群聊
- 一对一私聊
- 视频/动态内容社区
- 商家后台
- 多城市运营后台
- 复杂推荐算法
- 会员体系

## 5.3 对现有能力的处理策略

| 现有能力 | 处理策略 |
|---|---|
| 扫码核销 | 保留，但降级为补充确认手段 |
| 发起人审批参与者 | 默认关闭，仅高风险活动保留 |
| 微信号解锁 | 弱化，MVP 不作为主流程 |
| 分账能力 | 保留，用于爽约扣保或异常仲裁 |
| 冲突检测 | 直接复用，报名时继续生效 |
| 日历/海报 | 继续复用，并扩展新状态 |

---

## 6. 数据模型改造方案

## 6.1 `activities` 集合改造

当前 `activities` 主要字段偏向“单次约见”，需要扩展为“结构化组局活动”。

建议新增或调整字段如下：

| 字段 | 类型 | 说明 |
|---|---|---|
| `templateType` | string | 模板类型，如 `walk` / `convenience_store` / `cheap_meal` |
| `templateVersion` | number | 模板版本，便于后续模板升级 |
| `title` | string | 活动标题，继续保留 |
| `summary` | string | 一句话说明，替代纯自由描述 |
| `description` | string | 系统生成的结构化说明 |
| `budgetType` | string | `free` / `under_20` / `under_50` / `aa` |
| `budgetMin` | number | 预算下限，单位分 |
| `budgetMax` | number | 预算上限，单位分 |
| `serviceFee` | number | 平台服务费，单位分 |
| `bondAmount` | number | 保证金，单位分，替代 `depositTier` 语义 |
| `minParticipants` | number | 最低成局人数 |
| `maxParticipants` | number | 最大人数 |
| `approvedParticipants` | number | 当前成功占位人数 |
| `waitlistCount` | number | 候补人数 |
| `signupDeadline` | Date | 报名截止时间 |
| `startCheckinAt` | Date | 签到开始时间 |
| `endCheckinAt` | Date | 签到结束时间 |
| `meetingPointText` | string | 集合说明 |
| `realNameRequired` | boolean | 是否要求实名 |
| `genderLimit` | string | `none` / `female_only` |
| `allowLateMinutes` | number | 允许迟到分钟数 |
| `allowAfterParty` | boolean | 是否允许转场 |
| `safetyTags` | array | 安全标签，如 `public_space` / `no_alcohol` |
| `atmosphereTags` | array | 氛围标签 |
| `riskLevel` | string | `low` / `medium` / `high` |
| `reviewStatus` | string | `approved` / `pending_review` / `rejected` |
| `status` | string | 新状态机字段 |
| `sourceReportId` | string | 如果为“发起同款”，记录来源战报 |

字段兼容策略：

- `depositTier` 第一阶段保留，同时新增 `bondAmount`
- 读接口优先返回新字段
- 旧页面未改造前，可在接口层做兼容映射

## 6.2 `participations` 集合改造

现有 `participations` 偏向“支付后等待审批”，需要改为“支付占位 -> 成局 -> 签到 -> 完成”。

建议字段如下：

| 字段 | 类型 | 说明 |
|---|---|---|
| `activityId` | string | 活动 ID |
| `participantId` | string | 参与者 ID |
| `status` | string | `pending_payment` / `paid` / `confirmed` / `waitlisted` / `checked_in` / `completed` / `cancelled` / `breached` |
| `serviceFeeAmount` | number | 服务费金额 |
| `bondAmount` | number | 保证金金额 |
| `refundStatus` | string | `none` / `bond_refunded` / `fully_refunded` / `partially_refunded` |
| `signupSource` | string | `activity_detail` / `report_reuse` / `template_reuse` |
| `checkinMethod` | string | `location` / `initiator_confirm` / `manual` |
| `checkinAt` | Date | 签到时间 |
| `checkinLocation` | object | 签到坐标 |
| `ratingSubmitted` | boolean | 是否已提交评价 |

## 6.3 `credits` 集合扩展

现有信用模型可继续保留，但字段需要扩展为活动平台视角：

| 字段 | 类型 | 说明 |
|---|---|---|
| `score` | number | 当前信用分 |
| `totalInitiated` | number | 累计发起活动数 |
| `totalJoined` | number | 累计参加活动数 |
| `totalCompleted` | number | 累计完成活动数 |
| `totalNoShow` | number | 爽约次数 |
| `totalComplaints` | number | 被投诉次数 |
| `positiveTags` | array | 正向标签统计 |
| `negativeTags` | array | 负向标签统计 |
| `realNameVerified` | boolean | 是否实名 |
| `creditLevel` | string | 新用户/可信/优质/高风险 |

## 6.4 新增集合建议

MVP 建议至少新增以下集合：

### `activity_templates`

存储模板配置：

- 模板名称
- 模板类型
- 默认标题
- 默认描述
- 推荐预算
- 推荐人数
- 安全规则
- 风险等级
- 是否启用

### `activity_reviews`

存储活动结束后互评：

- `activityId`
- `fromUserId`
- `toUserId`
- `role`
- `positiveTags`
- `negativeTags`
- `comment`

### `activity_reports_summary`

存储活动战报：

- `activityId`
- `templateType`
- `participantCount`
- `avgCost`
- `durationMinutes`
- `routeText`
- `atmosphereTags`
- `quote`
- `photos`
- `reusable`

### `moderation_tasks`

用于高风险活动审核与风控动作追踪。

---

## 7. 状态机重构方案

## 7.1 活动状态机

建议将现有状态机调整为：

```text
draft（仅前端本地态）
  ↓
recruiting（招募中）
  ↓ 达到最低成局人数
formed（已成局）
  ↓ 到达报名截止时间
locked（已锁局）
  ↓ 活动开始
in_progress（进行中）
  ↓ 活动结束 + 结算完成
finished（已结束）

异常分支：
- cancelled（已取消）
- pending_review（审核中）
- removed（已下架）
```

状态映射建议：

| 旧状态 | 新状态 |
|---|---|
| `pending` | `recruiting` |
| `confirmed` | `formed` 或 `locked` |
| `verified` | `finished` |
| `expired` / `settled` | 视结果映射为 `finished` / `cancelled` |

## 7.2 参与记录状态机

```text
pending_payment
  ↓ 支付成功
paid
  ↓ 活动已成局
confirmed
  ↓ 签到成功
checked_in
  ↓ 活动结束 + 评价完成
completed

异常分支：
- waitlisted
- cancelled
- breached
- refunded
```

## 7.3 状态机落地建议

- 将状态流转逻辑集中到共享模块，如 `cloudfunctions/_shared/activityStatus.js`
- 所有云函数不要各自写一套状态判断
- 对退款、成局、签到、结束结算分别封装触发器函数

---

## 8. 前端实施计划

## 8.1 页面改造总览

| 页面 | 当前状态 | 目标改造 |
|---|---|---|
| `pages/index/index` | 基础附近活动列表 | 增加筛选、招募信息、预算、模板类型、安全标签 |
| `pages/activity/create/create` | 手写活动表单 | 改为模板发起流程 |
| `pages/activity/detail/detail` | 契约详情 + 报名 | 改为结构化活动详情 + 支付 + 成局 + 签到说明 |
| `pages/activity/manage/manage` | 发起人审批 | 改为活动管理、集合说明、签到确认、取消活动 |
| `pages/verify/qrcode` | 核销码 | 降级为补充确认页 |
| `pages/verify/scan` | 发起人扫码 | 降级为补充履约入口 |
| `pages/user/history/history` | 历史活动 | 增加战报入口、评价状态 |
| `pages/user/profile/profile` | 我的中心 | 增加发起次数、参加次数、信用标签 |
| `pages/user/calendar/calendar` | 契约日历 | 兼容新状态颜色 |
| `pages/user/poster/poster` | 海报 | 后续可扩展战报分享素材 |

## 8.2 新增页面建议

### `pages/activity/template-select`

职责：

- 选择模板
- 展示模板说明
- 带用户进入发起页

### `pages/activity/checkin`

职责：

- 定位签到
- 签到状态展示
- 发起人确认补充入口

### `pages/activity/review`

职责：

- 活动结束互评
- 正负标签选择
- 可选一句话评价

### `pages/activity/report-detail`

职责：

- 展示活动战报
- 发起同款

### `pages/rules/index`

职责：

- 平台规则
- 履约规则
- 安全规则

## 8.3 组件改造建议

### `components/activity-card`

当前卡片信息过少，需要升级为展示：

- 标题
- 模板类型
- 距离
- 时间
- 预算
- 当前人数 / 最低成局人数 / 最大人数
- 报名费 + 保证金
- 发起人信用标签
- 实名/女生局/公共空间标签

### 新增组件建议

- `template-chip`
- `safety-tag`
- `participant-progress`
- `fee-breakdown`
- `credit-summary`

---

## 9. 后端实施计划

## 9.1 保留并改造的云函数

### `createActivity`

改造为模板化发起接口：

- 输入从自由表单改成“模板 + 条件”
- 后端生成默认标题、描述、规则
- 新增风险识别与模板规则填充

### `getActivityList`

改造为结构化列表接口：

- 增加筛选参数：时间、距离、预算、模板类型、安全条件
- 返回 `serviceFee`、`bondAmount`、`minParticipants`、`remainingToForm`
- 支持推荐排序而不只是距离排序

### `getActivityDetail`

改造为组局详情接口：

- 返回模板信息、结构化说明、规则、安全标签、签到规则
- 返回发起人信用摘要，而不是只有单一分数
- 返回当前用户的报名状态、签到状态、评价状态

### `createDeposit`

改造成支付报名接口：

- 支付金额 = `serviceFee + bondAmount`
- 服务费记为平台收入
- 保证金进入待退款/待扣保流程
- 支持取消规则

### `reportArrival`

升级为签到接口：

- 活动开始前 15 分钟可签到
- 校验时间窗和距离
- 到场成功后更新参与状态

### `manualVerify`

继续保留，作为签到失败补充手段：

- 发起人可确认参与者到场
- 适用于定位失败、手机权限问题、特殊申诉

### `autoArbitrate`

改造成爽约仲裁：

- 未签到用户按规则处理保证金
- 发起人未到场触发全额退款或活动异常
- 多人投诉可冻结活动结算

## 9.2 新增云函数建议

### `getActivityTemplates`

返回模板列表与模板配置。

### `previewActivityDraft`

根据用户选择的模板与条件生成预览标题、描述、规则。

### `autoFormActivity`

在参与者支付成功、取消、候补递补时自动判断：

- 是否达成最低成局人数
- 是否切换为 `formed`
- 是否需要释放候补

### `lockActivity`

活动到达报名截止时间时：

- 状态改为 `locked`
- 关闭新报名
- 准备签到窗口

### `submitActivityReview`

提交互评，更新用户信用标签和统计。

### `generateActivityReport`

活动结束后生成结构化战报。

### `createActivityFromReport`

通过战报发起同款，回填模板、预算、标签，只让用户改时间地点。

### `rankActivities`

第一版可以作为内部模块，不一定独立为云函数；用于活动排序评分。

## 9.3 后端共享模块建议

在 `cloudfunctions/_shared` 中新增：

- `templates.js`：模板定义和生成逻辑
- `activityStatus.js`：统一状态机
- `pricing.js`：服务费与保证金计算
- `ranking.js`：列表排序规则
- `checkin.js`：签到窗口、签到距离判断
- `review.js`：评价标签和信用更新
- `reportBuilder.js`：战报生成

---

## 10. 支付与结算改造方案

## 10.1 支付结构

当前项目只有押金概念，需要改成双金额结构：

- 服务费：平台收入，不退或按规则退
- 保证金：签到后退还，爽约时扣除

建议交易流水支持：

| type | 说明 |
|---|---|
| `service_fee` | 服务费支付 |
| `bond_payment` | 保证金支付 |
| `bond_refund` | 保证金退款 |
| `bond_penalty` | 爽约扣保 |
| `activity_cancel_refund` | 活动取消退款 |

## 10.2 取消规则

建议在 MVP 采用清晰规则：

- 报名截止前主动取消：退保证金，服务费不退
- 报名截止后取消：默认不退服务费，保证金按规则部分退还或不退
- 活动取消：保证金全退，服务费按策略退或发券补偿

## 10.3 现有支付能力复用方式

- `createDeposit` 改为总支付下单
- `refundDeposit` 改为退款保证金，不再承担全部退款语义
- `splitDeposit` 改为扣保/补偿结算
- `processVerifiedRefunds` 可改为“已签到退款批处理”

---

## 11. 模板系统实施方案

## 11.1 MVP 模板首批范围

建议先落 6 个模板，与 UGC 文档保持一致：

1. 散步瞎逛局
2. 便利店坐坐局
3. 低价吃饭局
4. 免费展览局
5. 公园发呆局
6. 自习搭子局

## 11.2 模板配置项

每个模板至少包含：

- `templateType`
- `name`
- `defaultTitle`
- `defaultSummary`
- `defaultDescription`
- `budgetType`
- `recommendedBondAmount`
- `recommendedServiceFee`
- `recommendedMinParticipants`
- `recommendedMaxParticipants`
- `defaultSafetyTags`
- `defaultAtmosphereTags`
- `defaultRules`
- `riskLevel`

## 11.3 模板生成机制

发起流程建议：

1. 用户选模板
2. 用户补时间、地点、人数、预算、几个开关项
3. 后端根据模板生成活动标题、说明、规则
4. 用户仅允许微调标题和一句话说明

这样可以避免空白页和低质量活动。

---

## 12. 推荐与列表排序方案

## 12.1 MVP 排序公式

第一版不做复杂个性化推荐，只做综合排序分：

`排序分 = 距离分 + 快成局分 + 时间临近分 + 信用分 + 安全分 + 预算友好分`

建议权重：

- 距离：30%
- 快成局：20%
- 时间临近：15%
- 发起人信用：15%
- 安全标签：10%
- 低预算友好：10%

## 12.2 筛选条件落地

首页支持：

- 时间
- 距离
- 预算
- 类型
- 安全条件

第一版可只做单选或轻量多选，不做复杂组合筛选器。

---

## 13. 签到、评价、信用升级方案

## 13.1 签到主流程

主流程改为：

1. 活动开始前 15 分钟开放签到
2. 参与者在签到页定位签到
3. 系统记录签到位置与时间
4. 活动结束后自动批量退还保证金

补充流程：

- 发起人确认到场
- 手工申诉处理

## 13.2 评价机制

活动结束后触发互评：

- 正向标签
- 负向标签
- 可选一句话评论

评价结果反哺：

- 信用等级
- 详情页信用标签
- 首页排序参考
- 风控模型

## 13.3 信用展示升级

详情页展示建议从单一分数升级为：

- 信用分
- 已实名
- 发起次数
- 参加次数
- 准时率
- 爽约次数
- 被投诉次数
- 高频正向标签

---

## 14. 战报与同款复用实施方案

## 14.1 战报生成触发时机

活动满足以下条件后自动生成战报草稿：

- 活动已结束
- 已有足够签到记录
- 至少 1 条有效评价

战报支持用户补充：

- 一句话感受
- 照片
- 实际人均花费

## 14.2 战报内容结构

战报至少包含：

- 活动标题
- 模板类型
- 参与人数
- 人均花费
- 活动路线
- 时长
- 氛围标签
- 评价摘要
- 一句话引用

## 14.3 发起同款

战报页增加“发起同款”按钮：

- 自动带出模板类型
- 自动带出预算与标签
- 自动生成标题骨架
- 用户只改时间与地点即可发布

这是后续增长闭环的关键。

---

## 15. 风控与安全实施方案

## 15.1 风控原则

UGC 化后，安全风险比当前项目更高，因此以下能力必须前置：

- 模板风险等级
- 标题/描述/评价文本安全审核
- 高风险场景审核
- 多人举报下架
- 发起人频繁取消降权
- 爽约用户限制报名

## 15.2 高风险活动处理

以下类型第一版建议不开放或必须审核：

- 酒吧
- KTV
- 夜爬
- 自驾远途
- 私宅聚会
- 通宵活动
- 一对一夜间活动

## 15.3 社交边界控制

为避免偏航，建议：

- 默认不展示联系方式
- 不做自由私聊
- 不做陌生人主页导流
- 不鼓励活动外持续社交关系沉淀

---

## 16. 测试实施计划

## 16.1 单元测试

新增测试覆盖：

- 模板生成逻辑
- 状态机流转
- 报名/取消规则
- 自动成局判断
- 签到窗口判断
- 评价标签统计
- 战报生成逻辑

## 16.2 集成测试

覆盖关键闭环：

1. 模板发起 -> 发布成功
2. 多人支付报名 -> 达到最低人数 -> 自动成局
3. 到时锁局 -> 开启签到 -> 到场退款
4. 活动结束 -> 互评 -> 信用更新
5. 生成战报 -> 发起同款

## 16.3 回归测试重点

现有高风险回归点：

- 微信支付下单与回调
- 保证金退款
- 分账/扣保结算
- 内容安全审核
- 历史活动查询
- 日历和海报

---

## 17. 阶段性交付计划

## 17.1 Phase 0：方案冻结与数据结构准备

目标：

- 冻结产品边界
- 确认状态机
- 完成集合与字段设计

交付物：

- 本实施计划
- 新数据模型文档
- 状态机图
- 索引调整方案

预计改动：

- `docs/`
- `cloudfunctions/_shared/db.js`
- 数据库索引文档

## 17.2 Phase 1：模板发起与活动流升级

目标：

- 活动能按模板发起
- 首页和详情能展示结构化信息

交付物：

- 模板选择页
- 新发起页
- 活动流筛选器
- 结构化活动卡片

预计改动：

- `miniprogram/pages/activity/create/*`
- 新增 `miniprogram/pages/activity/template-select/*`
- `miniprogram/pages/index/*`
- `miniprogram/components/activity-card/*`
- `cloudfunctions/createActivity`
- `cloudfunctions/getActivityList`
- `cloudfunctions/getActivityDetail`

## 17.3 Phase 2：支付与自动成局

目标：

- 支持服务费 + 保证金
- 支持最低成局人数和自动成局

交付物：

- 新支付逻辑
- 成局状态切换
- 候补与锁局逻辑

预计改动：

- `cloudfunctions/createDeposit`
- `cloudfunctions/payCallback`
- `cloudfunctions/refundDeposit`
- `cloudfunctions/splitDeposit`
- 新增 `autoFormActivity`
- 新增 `lockActivity`

## 17.4 Phase 3：签到、评价、信用升级

目标：

- 完成签到和活动结束闭环
- 让信用体系反映多人组局场景

交付物：

- 签到页
- 评价页
- 信用摘要升级

预计改动：

- 新增 `pages/activity/checkin/*`
- 新增 `pages/activity/review/*`
- `cloudfunctions/reportArrival`
- `cloudfunctions/manualVerify`
- 新增 `submitActivityReview`
- `cloudfunctions/getCreditInfo`

## 17.5 Phase 4：战报、同款与推荐

目标：

- 构建内容复用飞轮

交付物：

- 战报页
- 发起同款
- 首页推荐排序升级

预计改动：

- 新增 `pages/activity/report-detail/*`
- 新增 `generateActivityReport`
- 新增 `createActivityFromReport`
- `cloudfunctions/getActivityList`

## 17.6 Phase 5：风控、灰度、上线

目标：

- 控制风险
- 做单城灰度验证

交付物：

- 高风险活动审核
- 指标监控
- 灰度发布清单

---

## 18. 推荐开发顺序

为降低返工，建议严格按下面顺序执行：

1. 先写新的数据模型和状态机代码
2. 再改 `createActivity/getActivityList/getActivityDetail`
3. 再改发起页、首页卡片、详情页
4. 再改支付下单和退款结算
5. 再接自动成局和锁局
6. 再补签到与评价
7. 最后做战报、同款和推荐排序

不要反过来先做页面，否则接口和状态变化后会大量返工。

---

## 19. 关键风险与规避建议

## 19.1 最大风险

### 风险 1：产品边界失控

表现：

- 用户想要私聊
- 用户把活动当交友入口
- 高风险场景渗透

措施：

- 不做泛私聊
- 活动驱动优先
- 高风险模板不上线

### 风险 2：状态机改造导致支付与退款出错

表现：

- 支付成功但参与状态异常
- 保证金无法正确退款
- 旧活动状态无法兼容

措施：

- 先封装统一状态机模块
- 增加迁移兼容层
- 支付与退款全链路回归测试

### 风险 3：签到逻辑过重

表现：

- 用户定位权限拒绝
- 发起人不会操作
- 到场但退款失败

措施：

- 定位签到为主，手动确认兜底
- 提前做引导文案
- 退款支持异步补偿任务

### 风险 4：群聊能力投入过大

表现：

- 被 IM 需求拖慢主线

措施：

- MVP 不做完整群聊
- 仅做集合说明、签到入口、公告页、群入口占位

---

## 20. 上线建议

## 20.1 灰度策略

建议采用单城单片区灰度：

- 先选 1 个城市、1-2 个高密度商圈或大学城
- 只开放低风险模板
- 重点观察成局率、签到率、投诉率

## 20.2 首批模板上线建议

第一批只开放：

- 散步瞎逛局
- 便利店坐坐局
- 公园发呆局
- 自习搭子局

暂缓：

- 夜市吃饭
- 桌游拼局
- 夜间活动

## 20.3 MVP 成功判断标准

建议以以下指标作为阶段验收：

- 模板发起占比 >= 80%
- 活动发布完成率 >= 60%
- 报名支付转化率 >= 5%
- 成局率 >= 30%
- 签到率 >= 70%
- 举报率 <= 3%

---

## 21. 结论

这次改造的本质，不是替换 `不鸽令`，而是给 `不鸽令` 增加一层更适合 UGC 同城组局的产品外壳。

应该保留的，是现有项目已经很有价值的底层能力：

- 押金与退款
- 信用与仲裁
- LBS 与冲突检测
- 举报与安全

应该新增的，是 UGC 方案真正缺失但决定增长上限的能力：

- 模板化发起
- 自动成局
- 定位签到
- 评价标签
- 战报与发起同款

按本计划推进后，项目会从“线下约见履约工具”升级为“有履约能力的低成本同城组局平台”，并且改造路径相对平滑、可分阶段上线、风险可控。
