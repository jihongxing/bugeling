# 实现计划: 核销码验证系统

## 概述

基于设计文档，按增量方式实现核销码验证系统：先实现 3 个云函数（generateQrToken → verifyQrToken → reportArrival），再实现 2 个前端页面（核销码展示页 → 扫码核销页）。每个步骤都在前一步基础上构建，确保无孤立代码。

## Tasks

- [x] 1. 实现 generateQrToken 云函数
  - [x] 1.1 创建 generateQrToken 云函数目录和依赖配置
    - 创建 `cloudfunctions/generateQrToken/index.js` 和 `cloudfunctions/generateQrToken/package.json`
    - package.json 添加 `wx-server-sdk` 和 `jsonwebtoken` 依赖
    - 在 index.js 中引入 `cloud`、`jwt`、`crypto`、`_shared/db`、`_shared/config`、`_shared/response`
    - _Requirements: 1.6, 1.7_

  - [x] 1.2 实现 generateQrToken 核心逻辑
    - 通过 `cloud.getWXContext().OPENID` 获取调用者身份
    - 校验 `activityId` 非空，缺失返回 1001
    - 查询参与记录：`participantId=openId, activityId, status='approved'`，不存在返回 1004
    - 生成 nonce：`crypto.randomBytes(16).toString('hex')`
    - 签发 JWT：`jwt.sign({ activityId, participantId, nonce }, JWT_SECRET, { expiresIn: 60 })`
    - 计算 expireAt：`Date.now() + 60 * 1000`
    - 更新参与记录：`{ qrToken: token, qrExpireAt: expireAt }`（覆盖旧值）
    - 返回 `{ code: 0, data: { qrToken, expireAt } }`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9_

  - [x]* 1.3 编写 generateQrToken 的属性测试
    - **Property 1: JWT Token 往返一致性** — 签发后验证应还原 activityId 和 participantId
    - **Property 3: 参与状态门控** — 仅 approved 状态可生成 Token，其他状态返回 1004
    - **Validates: Requirements 1.5, 1.6, 1.7, 2.4**

- [ ] 2. 实现 verifyQrToken 云函数
  - [x] 2.1 创建 verifyQrToken 云函数目录和依赖配置
    - 创建 `cloudfunctions/verifyQrToken/index.js` 和 `cloudfunctions/verifyQrToken/package.json`
    - package.json 添加 `wx-server-sdk` 和 `jsonwebtoken` 依赖
    - 引入 `_shared/db`、`_shared/config`、`_shared/response`、`_shared/credit`
    - _Requirements: 2.4, 2.7_

  - [x] 2.2 实现 verifyQrToken 核心校验逻辑
    - 通过 `cloud.getWXContext().OPENID` 获取调用者身份
    - 校验 `qrToken` 非空，缺失返回 1001
    - 使用 `jwt.verify(qrToken, JWT_SECRET)` 验证签名和过期，失败返回 4001
    - 从 payload 提取 `activityId` 和 `participantId`
    - 查询活动记录，校验 `openId === activity.initiatorId`，否则返回 1002
    - 查询参与记录，校验 `status === 'approved'`，否则返回 1004
    - 校验 `qrToken === participation.qrToken`，不匹配返回 4001
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12_

  - [x] 2.3 实现 verifyQrToken 核销成功后续操作
    - 更新参与记录：`status='verified'`, `verifiedAt=db.serverDate()`
    - 调用 `cloud.callFunction({ name: 'refundDeposit', data: { participationId } })` 触发退款
    - 调用 `updateCredit(participantId, 2)` 和 `updateCredit(initiatorId, 2)` 更新信用分
    - 查询该活动所有参与记录，若全部 `verified` 则更新活动 `status='verified'`
    - 返回 `{ code: 0, data: { success: true, participantInfo: { participationId, activityId }, refundStatus } }`
    - _Requirements: 2.13, 2.14, 2.15, 2.16, 2.17, 2.18_

  - [x]* 2.4 编写 verifyQrToken 的属性测试和单元测试
    - **Property 2: 单 Token 不变量** — 连续生成两次 Token，仅最新 Token 可通过验证
    - **Property 4: 发起人专属核销权** — 非发起人调用返回 1002
    - **Property 5: 核销成功状态转换** — 核销后 status=verified 且 verifiedAt 非空
    - **Property 6: 全员核销触发活动完成** — 所有参与者 verified 后活动 status=verified
    - 单元测试：Token 过期返回 4001、Token 签名错误返回 4001、参与记录不存在返回 1004
    - **Validates: Requirements 1.8, 2.7, 2.8, 2.11, 2.12, 2.13, 2.17**

- [x] 3. Checkpoint - 确保核销云函数测试通过
  - 确保所有测试通过，ask the user if questions arise.

- [x] 4. 实现 reportArrival 云函数
  - [x] 4.1 创建 reportArrival 云函数并实现核心逻辑
    - 创建 `cloudfunctions/reportArrival/index.js` 和 `cloudfunctions/reportArrival/package.json`
    - 通过 `cloud.getWXContext().OPENID` 获取调用者身份
    - 校验 `activityId` 非空、`latitude`/`longitude` 为有效数值，否则返回 1001
    - 查询活动记录，不存在返回 1003
    - 身份校验：发起人（openId === initiatorId）或已 approved 参与者，否则返回 1002
    - 发起人 → 更新 activity 的 `arrivedAt` 和 `arrivedLocation`
    - 参与者 → 更新 participation 的 `arrivedAt` 和 `arrivedLocation`
    - 实现 `calculateDistance(lat1, lon1, lat2, lon2)` Haversine 公式
    - 计算用户坐标与活动地点距离，返回 `{ success: true, distance }`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11_

  - [x]* 4.2 编写 reportArrival 的属性测试和单元测试
    - **Property 7: 到达记录权限校验** — 非发起人且非参与者返回 1002
    - **Property 8: 到达记录路由正确性** — 参与者写入 participation，发起人写入 activity
    - **Property 9: Haversine 距离计算正确性** — 非负性、同点为零、对称性
    - 单元测试：活动不存在返回 1003、参数缺失返回 1001、已知坐标距离验证
    - **Validates: Requirements 3.6, 3.7, 3.8, 3.9, 3.10**

- [x] 5. Checkpoint - 确保所有后端云函数测试通过
  - 确保所有测试通过，ask the user if questions arise.

- [x] 6. 实现核销码展示页（参与者视角）
  - [x] 6.1 实现核销码页面基础结构和 QR 码生成
    - 在 `miniprogram/libs/` 中添加 `weapp-qrcode.min.js`（QR 码生成库）
    - 实现 `pages/verify/qrcode/qrcode.js`：onLoad 获取 activityId、调用 generateQrToken、渲染二维码
    - 实现 `pages/verify/qrcode/qrcode.wxml`：活动标题、二维码 canvas、倒计时、提示文案、到达按钮
    - 实现 `pages/verify/qrcode/qrcode.wxss`：二维码居中、倒计时样式、按钮样式
    - _Requirements: 4.1, 4.2, 4.3, 4.6, 4.7, 4.8_

  - [x] 6.2 实现倒计时和自动刷新逻辑
    - 实现 `startCountdown()` 方法：每秒更新倒计时显示
    - 倒计时到 10 秒时自动调用 `refreshQrCode()` 获取新 Token 并刷新二维码
    - 实现 `onUnload()` 清除定时器防止内存泄漏
    - _Requirements: 4.4, 4.5, 4.11_

  - [x] 6.3 实现"我已到达现场"按钮功能
    - 实现 `handleArrival()` 方法：调用 `wx.getLocation` 获取坐标 → 调用 reportArrival 上报
    - 成功后将按钮变更为"已报告到达 ✓"并禁用
    - _Requirements: 4.9, 4.10_

- [x] 7. 实现扫码核销页（发起人视角）
  - [x] 7.1 实现扫码核销页基础结构和参与者列表
    - 实现 `pages/verify/scan/scan.js`：onLoad 获取 activityId、加载参与者列表
    - 实现 `formatParticipantStatus(participation)` 格式化函数：verified → "✅ 昵称 时间"，approved → "⏳ 昵称 待核销"
    - 实现 `getErrorMessage(code)` 错误码映射函数
    - 实现 `pages/verify/scan/scan.wxml`：提示文案、扫码按钮、参与者列表、到达按钮
    - 实现 `pages/verify/scan/scan.wxss`：列表样式、状态图标样式
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.11_

  - [x] 7.2 实现扫码核销和结果处理
    - 实现 `handleScan()` 方法：调用 `wx.scanCode({ scanType: ['qrCode'] })` → 获取 Token → 调用 verifyQrToken
    - 核销成功：显示绿色对勾成功动画 + 刷新参与者列表
    - 核销失败：根据错误码（4001/1002/1004）显示对应中文提示
    - _Requirements: 5.5, 5.6, 5.7, 5.8, 5.9, 5.10_

  - [x] 7.3 实现发起人"我已到达现场"按钮
    - 实现 `handleArrival()` 方法（与核销码页面逻辑一致）
    - _Requirements: 5.12, 5.13_

  - [x]* 7.4 编写前端工具函数的属性测试
    - **Property 10: 参与者状态格式化** — verified 包含 ✅ 和时间，approved 包含 ⏳ 和待核销
    - **Property 11: 错误码映射完整性** — 4001/1002/1004 映射到不同的中文提示
    - **Validates: Requirements 5.3, 5.8, 5.9, 5.10**

- [x] 8. 最终 Checkpoint - 确保所有测试通过
  - 确保所有测试通过，ask the user if questions arise.

## Notes

- 标记 `*` 的任务为可选测试任务，可跳过以加速 MVP 开发
- 每个任务引用了具体的需求编号以确保可追溯性
- 属性测试验证通用正确性，单元测试验证具体边界和错误条件
- generateQrToken 和 verifyQrToken 均需在 package.json 中添加 jsonwebtoken 依赖
- 前端 QR 码生成使用 weapp-qrcode 库，放入 miniprogram/libs/ 目录
