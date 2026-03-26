# 实现计划：活动 CRUD 云函数

## 概述

将活动管理后端的 5 个核心云函数设计转化为可执行的编码任务。每个任务递增构建，先实现共享校验模块，再逐个实现云函数，最后集成验证。所有代码使用 JavaScript（Node.js + wx-server-sdk）。

依赖 Spec 1（project-scaffold）已创建的目录结构和共享模块骨架。

## 任务

- [x] 1. 创建共享校验和分页模块
  - [x] 1.1 创建 `cloudfunctions/_shared/validator.js`，实现参数校验辅助函数：`validateString(value, fieldName, minLen, maxLen)`、`validateEnum(value, fieldName, allowedValues)`、`validateIntRange(value, fieldName, min, max)`、`validateLocation(location)`、`validateFutureTime(value, fieldName, minHoursFromNow)`
    - 每个函数返回 `{ valid: boolean, error?: string }`
    - _Requirements: 1.2, 1.3, 1.4_
  - [x] 1.2 创建 `cloudfunctions/_shared/pagination.js`，实现分页辅助函数：`paginate(total, page, pageSize)` 返回 `{ skip, limit, hasMore }`
    - _Requirements: 2.5, 2.7_
  - [x] 1.3 创建 `cloudfunctions/_shared/response.js`，实现统一响应辅助函数：`successResponse(data)`、`errorResponse(code, message)`
    - _Requirements: 1.3, 1.11_
  - [x]* 1.4 为 validator.js 编写属性基测试
    - **Property 1: createActivity 参数校验正确性**
    - **Validates: Requirements 1.2, 1.3, 1.4**
  - [x]* 1.5 为 pagination.js 编写属性基测试
    - **Property 6: 分页逻辑正确性**
    - **Validates: Requirements 2.5, 2.7**

- [x] 2. 实现 createActivity 云函数
  - [x] 2.1 实现 `cloudfunctions/createActivity/index.js` 主逻辑：获取 openId、参数校验（使用 validator.js）、调用 msgSecCheck 检查 title 和 identityHint、信用分检查（使用 `_shared/credit.js`）、构建 GeoPoint 格式 location、写入 activities 集合、返回 activityId
    - 定义 `DEPOSIT_TIERS = [990, 1990, 2990, 3990, 4990]` 常量
    - 抽取 `checkCreditForCreate(db, openId)` 为可测试的内部函数
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11_
  - [x]* 2.2 为信用分创建限制逻辑编写属性基测试
    - **Property 2: 信用分创建限制**
    - **Validates: Requirements 1.8, 1.9**
  - [x]* 2.3 为活动记录创建完整性编写属性基测试
    - **Property 3: 活动记录创建完整性**
    - **Validates: Requirements 1.10, 1.11**

- [x] 3. 实现 getActivityList 云函数
  - [x] 3.1 实现 `cloudfunctions/getActivityList/index.js` 主逻辑：参数校验（latitude/longitude 必填，radius 默认 20000，page 默认 1，pageSize 默认 20 最大 50）、使用 aggregate + geoNear 进行 GEO 查询（过滤 status=pending）、按距离排序、分页处理、批量查询发起人信用分、组装返回数据（含 distance 字段和分页信息）
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_
  - [x]* 3.2 为 GEO 查询过滤和排序编写属性基测试
    - **Property 4: GEO 查询仅返回 pending 活动**
    - **Property 5: 活动列表按距离升序排列**
    - **Validates: Requirements 2.3, 2.4**

- [x] 4. Checkpoint - 确保创建和列表查询功能完整
  - 确保 createActivity 和 getActivityList 的所有测试通过，ask the user if questions arise.

- [x] 5. 实现 getActivityDetail 云函数
  - [x] 5.1 实现 `cloudfunctions/getActivityDetail/index.js` 主逻辑：参数校验（activityId 必填）、查询活动记录（不存在返回 1003）、查询发起人信用分、查询调用者参与记录（myParticipation）、实现 `shouldUnlockWechatId(participation, meetTime)` 判断 wechatId 解锁条件、组装返回数据
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_
  - [x]* 5.2 为 wechatId 条件解锁逻辑编写属性基测试
    - **Property 7: wechatId 条件解锁**
    - **Validates: Requirements 3.5, 3.6**
  - [x]* 5.3 为 myParticipation 条件返回编写属性基测试
    - **Property 8: myParticipation 条件返回**
    - **Validates: Requirements 3.7, 3.8**

- [x] 6. 实现 approveParticipant 云函数
  - [x] 6.1 实现 `cloudfunctions/approveParticipant/index.js` 主逻辑：参数校验（activityId + participationId 必填）、查询活动记录（不存在返回 1003）、校验发起人权限（openId !== initiatorId 返回 1002）、查询参与记录（不存在返回 1003，状态非 paid 返回 1004）、校验人数未满（currentParticipants >= maxParticipants 返回 1004）、更新参与记录 status 为 approved、活动 currentParticipants + 1、若活动 status 为 pending 则更新为 confirmed
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10_
  - [x]* 6.2 为发起人权限校验编写属性基测试
    - **Property 9: 发起人权限校验**
    - **Validates: Requirements 4.4, 5.4**
  - [x]* 6.3 为参与记录状态前置校验编写属性基测试
    - **Property 10: 参与记录状态前置校验**
    - **Validates: Requirements 4.6, 5.6**
  - [x]* 6.4 为 approve 操作状态变更编写属性基测试
    - **Property 11: approve 操作状态变更**
    - **Validates: Requirements 4.8, 4.9**

- [x] 7. 实现 rejectParticipant 云函数
  - [x] 7.1 实现 `cloudfunctions/rejectParticipant/index.js` 主逻辑：参数校验（activityId + participationId 必填）、查询活动记录（不存在返回 1003）、校验发起人权限（openId !== initiatorId 返回 1002）、查询参与记录（不存在返回 1003，状态非 paid 返回 1004）、更新参与记录 status 为 rejected、调用 `_shared/pay.js` 的 `refund` 方法触发全额退款
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9_
  - [x]* 7.2 为 reject 操作状态变更编写属性基测试
    - **Property 12: reject 操作状态变更**
    - **Validates: Requirements 5.7, 5.8**

- [x] 8. Checkpoint - 确保所有云函数功能完整
  - 确保 5 个云函数的所有测试通过，ask the user if questions arise.

- [x] 9. 创建数据库索引配置文档
  - [x] 9.1 创建 `cloudfunctions/_shared/indexes.md`，记录需要在云开发控制台手动创建的索引：activities.location（2dsphere）、activities.status+meetTime（复合索引）、participations.activityId+status（复合索引），包含创建步骤说明
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 10. 最终 Checkpoint - 验证所有功能完整
  - 确保所有云函数代码完整、共享模块正确引用、测试通过，ask the user if questions arise.

## 备注

- 标记 `*` 的任务为可选测试任务，可跳过以加速 MVP
- 每个任务引用具体需求编号以确保可追溯性
- 属性基测试使用 fast-check 库，与 Jest 集成
- 云函数依赖 wx-server-sdk，测试时需 mock
- 数据库索引需在云开发控制台手动创建，任务 9 仅生成配置文档
