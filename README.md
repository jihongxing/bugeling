# 不鸽令 · BugeLing

> 同城低成本轻工具组局产品，底层保留履约兜底能力

`不鸽令` 现在的产品结构分成两层。

表层是“轻工具版小局入口”，强调模板化发局、附近浏览、轻量加入、到场确认和一键再来。底层仍然保留押金、风控、争议处理和分账兜底，但不再作为主叙事。

## 技术栈

- 微信小程序原生开发（WXML / WXSS / JS）
- 微信云开发 CloudBase（云函数 Node.js + 云数据库 + 云存储）
- 微信支付（统一下单 / 退款 / 分账）
- Canvas 2D API（海报生成）
- Jest + fast-check（属性基测试）

## 项目结构

```
BugeLing/
├── miniprogram/                  # 小程序前端
│   ├── app.js / app.json / app.wxss
│   ├── pages/
│   │   ├── index/                # 首页 - LBS 活动列表
│   │   ├── activity/
│   │   │   ├── create/           # 发布活动
│   │   │   ├── detail/           # 活动详情（含冲突检测）
│   │   │   └── manage/           # 活动管理
│   │   ├── verify/
│   │   │   ├── qrcode/           # 核销码展示
│   │   │   └── scan/             # 扫码核销
│   │   ├── user/
│   │   │   ├── profile/          # 个人中心
│   │   │   ├── history/          # 历史活动
│   │   │   ├── calendar/         # 契约日程（月视图日历）
│   │   │   └── poster/           # 守约月报海报
│   │   └── report/               # 举报页面
│   ├── components/
│   │   ├── activity-card/        # 活动卡片
│   │   ├── deposit-tag/          # 押金标签
│   │   └── credit-badge/         # 信用徽章
│   ├── utils/
│   │   ├── api.js                # 云函数调用封装
│   │   ├── auth.js               # 登录态管理
│   │   ├── location.js           # LBS 工具
│   │   ├── format.js             # 格式化工具
│   │   ├── status.js             # 状态标签映射
│   │   ├── social.js             # 社交功能（微信号解锁）
│   │   └── date.js               # 日期工具（日历专用）
│   └── libs/                     # 第三方 SDK
│
├── cloudfunctions/               # 云函数
│   ├── _shared/                  # 共享模块
│   │   ├── db.js                 # 数据库封装
│   │   ├── response.js           # 统一响应格式
│   │   ├── config.js             # 环境变量
│   │   ├── pay.js                # 支付工具
│   │   ├── credit.js             # 信用分模块
│   │   ├── distance.js           # Haversine 距离计算
│   │   ├── calendar.js           # 日历状态映射与查询
│   │   ├── validator.js          # 参数校验
│   │   ├── pagination.js         # 分页工具
│   │   ├── safety.js             # 内容安全
│   │   ├── social.js             # 社交功能
│   │   └── reportBuilder.js      # 活动战报与同款复用构建
│   ├── createActivity/           # 创建活动
│   ├── createActivityFromReport/ # 从战报发起同款
│   ├── getActivityList/          # 活动列表
│   ├── getActivityDetail/        # 活动详情
│   ├── generateActivityReport/   # 生成活动战报
│   ├── approveParticipant/       # 同意参与者
│   ├── rejectParticipant/        # 拒绝参与者
│   ├── createDeposit/            # 创建押金支付
│   ├── payCallback/              # 支付回调
│   ├── refundDeposit/            # 退款
│   ├── splitDeposit/             # 分账
│   ├── generateQrToken/          # 生成核销码
│   ├── verifyQrToken/            # 核销验证
│   ├── reportArrival/            # 报告到达
│   ├── autoArbitrate/            # 自动仲裁兼容入口
│   ├── executeSplit/             # 分账执行兼容入口
│   ├── getCreditInfo/            # 信用分查询
│   ├── getMyActivities/          # 我的活动
│   ├── submitReport/             # 提交举报
│   ├── checkTextSafety/          # 文本安全检测
│   ├── checkImageSafety/         # 图片安全检测
│   ├── getCalendarActivities/    # 日历活动数据
│   ├── checkConflict/            # 时间冲突检测
│   ├── getPosterData/            # 海报数据
│   ├── cancelActivity/           # 取消活动
│   ├── manualVerify/             # 手动确认到场
│   └── processVerifiedRefunds/   # 已核销退款补偿兼容入口
│
├── tests/                        # 测试套件
│   ├── __tests__/                # 67 个测试文件，713 个测试用例
│   ├── __mocks__/                # wx-server-sdk mock
│   ├── jest.config.js
│   └── package.json
│
├── docs/                         # 项目文档
│   ├── 文档体系说明-不鸽令.md
│   ├── UGC 同城低成本组局小程序.md
│   ├── 实施计划-不鸽令UGC组局化改造.md
│   ├── API接口文档-不鸽令.md
│   ├── 环境配置说明-不鸽令.md
│   ├── 上线配置Checklist.md
│   ├── PRD-不鸽令-线下契约引擎.md
│   ├── 技术方案-不鸽令.md
│   ├── UI交互规范-不鸽令.md
│   └── 增长策略-微信群转发裂变.md
│
├── .kiro/specs/                  # 功能规格文档（9个模块）
├── SECURITY.md
├── CHANGELOG.md
└── project.config.json
```

## 功能模块

| 模块 | Spec | 状态 | 说明 |
|------|------|------|------|
| 项目脚手架 | project-scaffold | ✅ 完成 | 目录结构、全局配置、工具模块 |
| 活动 CRUD | activity-crud | ✅ 完成 | 创建/查询/详情/审批/拒绝 |
| 活动页面 | activity-pages | ✅ 完成 | 首页列表、发布、详情、管理 |
| 支付结算 | payment-settlement | ✅ 完成 | 押金支付、退款、分账、回调 |
| 核销二维码 | verification-qrcode | ✅ 完成 | JWT 动态核销码、扫码验证 |
| 信用体系 | credit-system | ✅ 完成 | 信用分计算、等级、访问控制 |
| 自动仲裁 | auto-arbitration | ✅ 完成 | 超时仲裁、裁决引擎、到场判定 |
| 内容安全与举报 | content-safety-report | ✅ 完成 | 文本/图片审核、举报流程 |
| 活动日历与海报 | activity-calendar-poster | ✅ 完成 | 月视图日历、冲突检测、Canvas 海报 |
| 战报与同款复用 | activity-report-reuse | ✅ 完成 | 活动战报生成、战报落库、发起同款预填 |

## 产品分层

- 表层产品：轻工具版小局入口。用户看到的是模板发起、附近小局流、轻量加入、到场确认和再来一次。
- 底层引擎：履约兜底能力。系统保留押金、支付退款、争议处理和内容安全，但不再前置。

这两层不是两个项目，而是同一个项目的“用户界面层”和“履约基础设施层”。

## 快速开始

### 环境要求

- 微信开发者工具（最新稳定版）
- Node.js ≥ 16.x
- 已注册的微信小程序 AppID
- 已开通云开发环境

### 调试避坑

- 首页启动排障优先使用微信开发者工具稳定基础库。我们在 `2026-05-08` 排查时确认，灰度基础库 `3.15.2` 会在冷启动阶段额外打印 `WAServiceMainContext.js ... Error: timeout`，即使首页没有发起定位和云函数请求也会出现，容易误判成业务超时。
- 如果你在开发者工具里看到启动期裸 `timeout`，先到 `详情 → 本地设置 → 调试基础库` 切回更多人使用的稳定版（已验证 `3.14.3` 可消除该噪音），再继续看业务日志。
- 首页首次进入当前是默认位置兜底，不会主动申请定位权限；只有点击“刷新附近”才会触发真实定位授权，这属于当前产品逻辑，不是启动期异常。

### 配置步骤

1. 克隆项目
```bash
git clone https://github.com/<your-username>/BugeLing.git
```

2. 配置 AppID
```json
// project.config.json
{ "appid": "<YOUR_APPID>" }
```

3. 配置云开发环境
```javascript
// miniprogram/app.js → onLaunch
wx.cloud.init({ env: '<YOUR_CLOUD_ENV_ID>' })
```

4. 创建数据库集合
在云开发控制台创建：`activities`、`participations`、`credits`、`transactions`、`reports`、`activity_reports_summary`

5. 上传云函数
在微信开发者工具中右键每个云函数目录 → "上传并部署：云端安装依赖"

6. 配置环境变量
在云开发控制台为云函数配置：`WX_MCH_ID`、`WX_API_KEY`、`JWT_SECRET` 等

详细配置参见 [环境配置说明](docs/环境配置说明-不鸽令.md)

### 运行测试

```bash
cd tests
npm install
npm test          # 运行全部 791 个测试
npm run test:coverage  # 生成覆盖率报告
```

## 核心业务流程

```
看到一个局
    ↓
觉得还行
    ↓
顺手加入
    ↓
到点见面
    ↓
顺利的话再来一局
```

说明：

- 当前已移除高频云函数定时器，改为按活动的事件驱动/懒收敛。
- 锁局、仲裁、分账、退款补偿仍在底层保留，但不再作为前台主流程。

## 测试覆盖

项目采用双重测试策略：

- 单元测试：验证具体示例和边界情况
- 属性基测试（PBT）：使用 fast-check 生成随机输入验证通用属性

覆盖的核心属性包括：Haversine 距离计算、时间重叠检测、守约率计算、日历状态映射、海报文案生成、月份切换逻辑、信用分计算、支付分账金额等。

## 文档索引

| 文档 | 说明 |
|------|------|
| [文档体系说明](docs/文档体系说明-不鸽令.md) | 当前文档分层、阅读顺序、事实优先级 |
| [当前表层产品 PRD](docs/UGC%20同城低成本组局小程序.md) | 同城低成本组局平台的产品定义 |
| [融合实施计划](docs/实施计划-不鸽令UGC组局化改造.md) | 组局平台与底层契约引擎的融合路线 |
| [API 接口文档](docs/API接口文档-不鸽令.md) | 当前云函数接口说明 |
| [环境配置](docs/环境配置说明-不鸽令.md) | 开发环境搭建与部署配置 |
| [上线 Checklist](docs/上线配置Checklist.md) | 当前上线前检查项 |
| [底层引擎 PRD](docs/PRD-不鸽令-线下契约引擎.md) | 早期线下契约引擎基线设计 |
| [底层技术方案](docs/技术方案-不鸽令.md) | 早期引擎架构与能力基线 |
| [底层 UI 规范](docs/UI交互规范-不鸽令.md) | 早期引擎界面规范参考 |
| [安全规范](SECURITY.md) | 安全策略与防护措施 |
| [更新日志](CHANGELOG.md) | 版本更新记录 |

## 开发状态

当前为 MVP 阶段，核心功能代码已完成，测试套件当前已全量通过（83 个测试套件、791 个测试用例），轻工具版主链路也已切到“发起、浏览、加入、碰头、再来一次”。产品定位已经升级为“同城低成本轻工具组局产品 + 底层履约引擎”，项目已配置 AppID 和云开发环境，待完成数据库索引、支付证书、环境变量、云函数部署和真机端到端联调后即可进入发布验收。

## License

MIT
