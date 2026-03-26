# 实现计划: 自动仲裁系统

## 概述

基于设计文档，将自动仲裁系统拆分为增量式编码任务。从共享距离计算模块开始，逐步实现 autoArbitrate 和 executeSplit 两个定时云函数，最后配置定时触发器。

## 任务

- [x] 1. 实现 `_shared/distance.js` 距离计算共享模块
  - [x] 1.1 创建 `cloudfunctions/_shared/distance.js`，实现 `calculateDistance`（Haversine 公式）和 `isPresent`（到场判定）两个函数并导出
    - `calculateDistance(lat1, lon1, lat2, lon2)` 返回两点间球面距离（米）
    - `isPresent(arrivedLocation, arrivedAt, activityLocation, threshold=1000)` 返回布尔值
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x]* 1.2 编写 `calculateDistance` 和 `isPresent` 的属性基测试
    - **Property 1: Haversine 距离计算正确性**
    - **Property 2: 到场判定正确性**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

- [x] 2. 实现 `autoArbitrate` 云函数核心裁决逻辑
  - [x] 2.1 创建 `cloudfunctions/autoArbitrate/index.js`，实现 `determineVerdict(participantPresent, initiatorPresent)` 纯函数并导出
    - 返回 `{ verdict, participationStatus, needsRefund, creditActions }` 结构
    - 覆盖 4 种场景：participant_breached / initiator_breached / present_unverified / mutual_noshow
    - _Requirements: 3.1, 4.1, 5.1, 6.1_

  - [x]* 2.2 编写 `determineVerdict` 的属性基测试
    - **Property 3: 仲裁裁决完整性与正确性**
    - **Property 4: 仲裁信用分操作正确性**
    - **Property 5: 仲裁资金操作正确性**
    - **Validates: Requirements 3.1, 3.3, 4.1, 4.3, 5.1, 5.3, 6.1, 6.2, 6.3, 6.4**

- [x] 3. 实现 `autoArbitrate` 云函数主流程
  - [x] 3.1 在 `cloudfunctions/autoArbitrate/index.js` 中实现 `exports.main`，包含：查询超时 confirmed 活动、遍历活动及其 approved 参与记录、调用 `isPresent` 判定到场、调用 `determineVerdict` 获取裁决、更新参与记录状态（含 breachedAt）、调用 refundDeposit/updateCredit、更新活动状态为 expired
    - 发起人到场判定每个活动仅执行一次
    - 每条参与记录和每个活动独立 try-catch 错误隔离
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 6.4, 9.1, 9.2, 9.3, 9.4_

  - [x] 3.2 创建 `cloudfunctions/autoArbitrate/package.json`，声明 `wx-server-sdk` 依赖
    - _Requirements: 1.1_

  - [x]* 3.3 编写 autoArbitrate 主流程的单元测试
    - 测试超时活动筛选逻辑
    - 测试无 approved 参与记录时直接 expired
    - 测试 4 种裁决场景的完整流程（mock 数据库和云函数调用）
    - 测试错误隔离（单条失败不影响后续处理）
    - **Property 6: breachedAt 设置不变量**
    - **Property 7: 活动超时后状态转换**
    - **Property 10: 错误隔离**
    - **Validates: Requirements 1.2, 1.4, 1.5, 3.2, 5.2, 9.1, 9.2**

- [x] 4. 检查点 - 确保 autoArbitrate 所有测试通过
  - 确保所有测试通过，如有疑问请询问用户。

- [x] 5. 实现 `executeSplit` 云函数
  - [x] 5.1 创建 `cloudfunctions/executeSplit/index.js`，实现 `exports.main`，包含：查询 breached 且 breachedAt+24h 过期的参与记录、检查 reports 集合中是否有 submitted 状态举报、无举报则调用 splitDeposit 并更新状态为 settled、每条记录独立 try-catch
    - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.6, 9.5_

  - [x] 5.2 创建 `cloudfunctions/executeSplit/package.json`，声明 `wx-server-sdk` 依赖
    - _Requirements: 7.1_

  - [x]* 5.3 编写 executeSplit 的单元测试
    - 测试缓冲期过滤逻辑（24 小时内的不处理）
    - 测试有待处理举报时跳过
    - 测试无举报时执行分账并更新状态
    - 测试 splitDeposit 失败时保持 breached 状态
    - **Property 8: executeSplit 缓冲期过滤**
    - **Property 9: executeSplit 申诉检查**
    - **Validates: Requirements 7.2, 7.3, 7.4, 7.5, 7.6, 9.5**

- [x] 6. 配置定时触发器
  - [x] 6.1 创建或更新 `cloudfunctions/autoArbitrate/config.json`，配置 cron `0 */1 * * * * *`（每分钟）
    - _Requirements: 8.1_

  - [x] 6.2 创建或更新 `cloudfunctions/executeSplit/config.json`，配置 cron `0 0 */1 * * * *`（每小时）
    - _Requirements: 8.2_

- [x] 7. 最终检查点 - 确保所有测试通过
  - 确保所有测试通过，如有疑问请询问用户。

## 备注

- 标记 `*` 的子任务为可选测试任务，可跳过以加速 MVP 开发
- 每个任务引用具体需求编号以确保可追溯性
- 属性基测试验证通用正确性属性，单元测试验证具体示例和边界情况
- 检查点确保增量验证
