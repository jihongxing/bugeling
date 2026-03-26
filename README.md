# 不鸽令 · BugeLing

> 线下契约引擎 —— 消除线下约见的不确定性

微信小程序，通过押金机制和信用体系，解决线下约见中"放鸽子"的痛点。用户发起活动并设定鸽子费，参与者支付押金报名，双方到场扫码核销后全额退款；违约方的押金将按比例补偿守约方。

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
├── cloudfunctions/               # 云函数（18个）
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
│   │   └── social.js             # 社交功能
│   ├── createActivity/           # 创建活动
│   ├── getActivityList/          # 活动列表
│   ├── getActivityDetail/        # 活动详情
│   ├── approveParticipant/       # 同意参与者
│   ├── rejectParticipant/        # 拒绝参与者
│   ├── createDeposit/            # 创建押金支付
│   ├── payCallback/              # 支付回调
│   ├── refundDeposit/            # 退款
│   ├── splitDeposit/             # 分账
│   ├── generateQrToken/          # 生成核销码
│   ├── verifyQrToken/            # 核销验证
│   ├── reportArrival/            # 报告到达
│   ├── autoArbitrate/            # 自动仲裁（定时）
│   ├── executeSplit/             # 分账执行（定时）
│   ├── getCreditInfo/            # 信用分查询
│   ├── getMyActivities/          # 我的活动
│   ├── submitReport/             # 提交举报
│   ├── checkTextSafety/          # 文本安全检测
│   ├── checkImageSafety/         # 图片安全检测
│   ├── getCalendarActivities/    # 日历活动数据
│   ├── checkConflict/            # 时间冲突检测
│   └── getPosterData/            # 海报数据
│
├── tests/                        # 测试套件
│   ├── __tests__/                # 67 个测试文件，713 个测试用例
│   ├── __mocks__/                # wx-server-sdk mock
│   ├── jest.config.js
│   └── package.json
│
├── docs/                         # 项目文档
│   ├── PRD-不鸽令-线下契约引擎.md
│   ├── 技术方案-不鸽令.md
│   ├── API接口文档-不鸽令.md
│   ├── UI交互规范-不鸽令.md
│   ├── 环境配置说明-不鸽令.md
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

## 快速开始

### 环境要求

- 微信开发者工具（最新稳定版）
- Node.js ≥ 16.x
- 已注册的微信小程序 AppID
- 已开通云开发环境

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
在云开发控制台创建：`activities`、`participations`、`credits`、`transactions`、`reports`

5. 上传云函数
在微信开发者工具中右键每个云函数目录 → "上传并部署：云端安装依赖"

6. 配置环境变量
在云开发控制台为云函数配置：`WX_MCH_ID`、`WX_API_KEY`、`JWT_SECRET` 等

详细配置参见 [环境配置说明](docs/环境配置说明-不鸽令.md)

### 运行测试

```bash
cd tests
npm install
npm test          # 运行全部 713 个测试
npm run test:coverage  # 生成覆盖率报告
```

## 核心业务流程

```
发起人创建活动（设定鸽子费）
    ↓
参与者支付押金报名
    ↓
发起人审批通过 → 活动状态变为"已成行"
    ↓
活动当天：双方到场 → 扫码核销 → 全额退款 + 信用分 +2
    ↓
未核销超时 60 分钟 → 自动仲裁：
  · 参与者未到场 → 押金 70% 补偿发起人，30% 平台
  · 发起人未到场 → 全额退款参与者
  · 双方未到场 → 各自退款，信用分 -5
```

## 测试覆盖

项目采用双重测试策略：

- 单元测试：验证具体示例和边界情况
- 属性基测试（PBT）：使用 fast-check 生成随机输入验证通用属性

覆盖的核心属性包括：Haversine 距离计算、时间重叠检测、守约率计算、日历状态映射、海报文案生成、月份切换逻辑、信用分计算、支付分账金额等。

## 文档索引

| 文档 | 说明 |
|------|------|
| [PRD](docs/PRD-不鸽令-线下契约引擎.md) | 产品需求文档 |
| [技术方案](docs/技术方案-不鸽令.md) | 架构设计与数据模型 |
| [API 接口文档](docs/API接口文档-不鸽令.md) | 全部云函数接口说明 |
| [UI 交互规范](docs/UI交互规范-不鸽令.md) | 界面设计规范 |
| [环境配置](docs/环境配置说明-不鸽令.md) | 开发环境搭建指南 |
| [安全规范](SECURITY.md) | 安全策略与防护措施 |
| [更新日志](CHANGELOG.md) | 版本更新记录 |

## 开发状态

当前为 MVP 阶段，所有 9 个功能模块的代码和测试已完成。待配置 AppID 和云开发环境后即可进行端到端联调。

## License

MIT
