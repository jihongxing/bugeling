# 实现计划：项目脚手架初始化

## 概述

将"不鸽令"微信小程序项目脚手架设计转化为可执行的编码任务。每个任务递增构建，确保无孤立代码。所有代码使用 JavaScript（微信小程序原生开发）。

## 任务

- [x] 1. 创建项目根配置文件
  - [x] 1.1 创建 `project.config.json`，配置 `miniprogramRoot`、`cloudfunctionRoot`、AppID 占位符和项目名称
    - _Requirements: 9.1, 9.2, 9.3_
  - [x] 1.2 创建 `miniprogram/app.json`，声明全部 9 个页面路由、TabBar 配置（首页/发布/我的）、导航栏样式和 `scope.userLocation` 权限
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  - [x] 1.3 创建 `miniprogram/app.wxss`，定义全局 CSS 变量（颜色、字号、间距、圆角）、全局字体族和基础组件样式类（`.page`、`.card`、`.btn-primary`、`.btn-secondary`、`.tag`）
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [x] 1.4 创建 `miniprogram/app.js`，包含 `wx.cloud.init()` 初始化（`traceUser: true`，环境 ID 占位符）和 `globalData`（`userInfo`、`openId`）
    - _Requirements: 4.1, 4.2_

- [x] 2. 创建小程序页面骨架文件
  - [x] 2.1 为全部 9 个页面创建目录和骨架文件（`.js`、`.json`、`.wxml`、`.wxss`）：`index`、`activity/create`、`activity/detail`、`activity/manage`、`verify/qrcode`、`verify/scan`、`user/profile`、`user/history`、`report`
    - 每个页面 `.js` 包含 `Page({})` 基础结构
    - 每个页面 `.json` 包含 `{}` 或基础配置
    - 每个页面 `.wxml` 包含页面名称注释占位
    - 每个页面 `.wxss` 为空文件
    - _Requirements: 1.2_

- [x] 3. 创建小程序组件骨架文件
  - [x] 3.1 为全部 3 个组件创建目录和骨架文件（`.js`、`.json`、`.wxml`、`.wxss`）：`activity-card`、`deposit-tag`、`credit-badge`
    - 每个组件 `.js` 包含 `Component({})` 基础结构和预期属性定义
    - 每个组件 `.json` 包含 `{ "component": true }`
    - 每个组件 `.wxml` 包含组件名称注释占位
    - 每个组件 `.wxss` 为空文件
    - _Requirements: 1.3_

- [x] 4. 创建前端工具模块
  - [x] 4.1 创建 `miniprogram/utils/api.js`，实现 `callFunction(name, data, options)` 方法，包含 `wx.cloud.callFunction` 封装、标准化错误处理和可选 `showLoading` 支持
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 4.2 创建 `miniprogram/utils/auth.js`，实现 `login()` 和 `getOpenId()` 方法，包含缓存逻辑和标准化错误处理
    - _Requirements: 6.1, 6.2, 6.3_
  - [x] 4.3 创建 `miniprogram/utils/location.js`，实现 `getCurrentLocation()`、`calculateDistance()`、`formatDistance()` 方法，包含授权失败错误处理
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - [x]* 4.4 为 `calculateDistance` 编写属性基测试
    - **Property 7: Haversine 距离计算正确性**
    - **Validates: Requirements 7.2**
  - [x]* 4.5 为 `formatDistance` 编写属性基测试
    - **Property 8: 距离格式化规则一致性**
    - **Validates: Requirements 7.3**
  - [x]* 4.6 为 `callFunction` 错误处理编写属性基测试
    - **Property 4: API 调用错误标准化**
    - **Validates: Requirements 5.2**
  - [x]* 4.7 为 `getOpenId` 缓存行为编写属性基测试
    - **Property 5: 登录态缓存幂等性**
    - **Validates: Requirements 6.2**

- [x] 5. Checkpoint - 确保前端代码结构完整
  - 确保所有文件已创建，ask the user if questions arise.

- [x] 6. 创建云函数目录结构
  - [x] 6.1 为全部 15 个云函数创建目录，每个包含 `index.js`（含 `cloud.init()` 和基础导出结构）和 `package.json`（含 `wx-server-sdk` 依赖）
    - 云函数列表：`createActivity`、`getActivityList`、`getActivityDetail`、`approveParticipant`、`rejectParticipant`、`createDeposit`、`payCallback`、`generateQrToken`、`verifyQrToken`、`reportArrival`、`autoArbitrate`、`executeSplit`、`getCreditInfo`、`submitReport`、`getMyActivities`
    - _Requirements: 2.1_
  - [x] 6.2 为 `autoArbitrate` 和 `executeSplit` 创建 `config.json` 定时触发器配置
    - _Requirements: 2.3_

- [x] 7. 创建云函数共享模块
  - [x] 7.1 创建 `cloudfunctions/_shared/db.js`，实现 `getDb()` 方法和 `COLLECTIONS` 常量对象
    - _Requirements: 10.1_
  - [x] 7.2 创建 `cloudfunctions/_shared/config.js`，实现 `getEnv(key)` 方法和 `ENV_KEYS` 常量对象
    - _Requirements: 10.2_
  - [x] 7.3 创建 `cloudfunctions/_shared/pay.js`，导出 `createOrder`、`refund`、`splitBill` 骨架方法（含 TODO 注释）
    - _Requirements: 10.3_
  - [x] 7.4 创建 `cloudfunctions/_shared/credit.js`，导出 `getCredit`、`updateCredit`、`checkAccess` 骨架方法（含 TODO 注释）
    - _Requirements: 10.4_
  - [x]* 7.5 为 `config.getEnv` 编写属性基测试
    - **Property 11: 环境变量读取健壮性**
    - **Validates: Requirements 10.2**

- [x] 8. 创建 libs 目录和第三方 SDK 占位
  - 创建 `miniprogram/libs/` 目录，添加 README 说明需放入 `qqmap-wx-jssdk.min.js`
  - _Requirements: 1.5_

- [x] 9. 最终 Checkpoint - 验证项目结构完整性
  - 确保所有目录和文件已创建，项目结构与设计文档一致，ask the user if questions arise.

## 备注

- 标记 `*` 的任务为可选测试任务，可跳过以加速 MVP
- 每个任务引用具体需求编号以确保可追溯性
- 属性基测试使用 fast-check 库，与 Jest 集成
- 所有骨架代码应可直接在微信开发者工具中运行（无语法错误）
