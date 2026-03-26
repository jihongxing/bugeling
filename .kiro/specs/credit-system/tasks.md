# 实现计划：信用分系统

## 概述

将信用分系统设计转化为可执行的编码任务。从共享模块 `_shared/credit.js` 的完整实现开始，逐步构建云函数、组件和页面。所有代码使用 JavaScript（微信小程序原生开发 + 云函数 Node.js）。

## 任务

- [x] 1. 实现 `_shared/credit.js` 共享模块（替换 Spec 1 骨架）
  - [x] 1.1 实现 `calculateNewScore(currentScore, delta)` 纯函数和 `calculateStatus(score)` 纯函数
    - `calculateNewScore`：返回 `Math.max(0, currentScore + delta)`
    - `calculateStatus`：score < 60 → 'banned'，score < 80 → 'restricted'，score >= 80 → 'active'
    - _Requirements: 2.1, 2.2, 2.5_
  - [x]* 1.2 为 `calculateNewScore` 和 `calculateStatus` 编写属性基测试
    - **Property 2: updateCredit 分数计算正确性**
    - **Property 4: 信用分到状态映射一致性（状态计算部分）**
    - **Validates: Requirements 2.1, 2.2, 2.5**
  - [x] 1.3 实现 `getCredit(openId)` 方法
    - 参数校验：openId 非空字符串
    - 查询 credits 集合，_id = openId
    - 不存在时自动创建初始记录（score: 100, totalVerified: 0, totalBreached: 0, status: 'active'）
    - 返回 { score, totalVerified, totalBreached, status }
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 1.4 实现 `updateCredit(openId, delta, reason)` 方法
    - 调用 getCredit 确保记录存在
    - 使用 calculateNewScore 计算新分数
    - delta > 0 且 reason === 'verified' 时 totalVerified 加 1
    - delta < 0 且 reason === 'breached' 时 totalBreached 加 1
    - 使用 calculateStatus 计算新状态
    - 记录 updatedAt 服务器时间
    - 返回更新后的完整记录
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_
  - [x]* 1.5 为 `updateCredit` 计数器逻辑编写属性基测试
    - **Property 3: updateCredit 计数器递增正确性**
    - **Validates: Requirements 2.3, 2.4**
  - [x] 1.6 实现 `checkAccess(openId)` 方法
    - 调用 getCredit 获取信用记录
    - score >= 80 → { allowed: true, reason: '', score }
    - score 在 [60, 80) → { allowed: true, reason: '信用分较低，部分功能受限', score }
    - score < 60 → { allowed: false, reason: '信用分不足，禁止使用平台', score }
    - _Requirements: 3.1, 3.2, 3.3_
  - [x]* 1.7 为 `checkAccess` 编写属性基测试
    - **Property 4: 信用分到状态映射一致性（checkAccess 部分）**
    - **Validates: Requirements 3.1, 3.2, 3.3**

- [x] 2. Checkpoint - 确保 credit.js 模块测试通过
  - 确保所有测试通过，ask the user if questions arise.

- [x] 3. 实现 getCreditInfo 云函数
  - [x] 3.1 实现 `getCreditLevel(score)` 纯函数和云函数主逻辑
    - `getCreditLevel`：score >= 100 → '信用极好'，score >= 80 → '信用良好'，score >= 60 → '信用一般'，score < 60 → '信用较差'
    - 云函数通过 WX_Context 获取 openId，调用 credit.getCredit，计算 level，返回标准响应
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - [x]* 3.2 为 `getCreditLevel` 编写属性基测试
    - **Property 5: 信用等级描述映射正确性**
    - **Validates: Requirements 4.3**

- [x] 4. 实现 getMyActivities 云函数
  - [x] 4.1 实现 `queryInitiatorActivities` 查询函数
    - 查询 activities 集合中 initiatorId = openId 的记录
    - 按 createdAt 降序排列，支持分页
    - _Requirements: 5.2, 5.5, 5.6_
  - [x] 4.2 实现 `queryParticipantActivities` 查询函数
    - 查询 participations 中 participantId = openId 的记录
    - 关联查询 activities，附带 participationStatus 字段
    - 按 createdAt 降序排列，支持分页
    - _Requirements: 5.3, 5.5, 5.6, 5.7_
  - [x] 4.3 实现 `queryAllActivities` 合并查询函数和云函数主入口
    - 合并发起人和参与者活动，去重，按 createdAt 降序排列，分页
    - 云函数入口：解析 role/page/pageSize 参数，路由到对应查询函数，返回 { list, total, hasMore }
    - _Requirements: 5.1, 5.4, 5.5, 5.6, 5.8_
  - [x]* 4.4 为活动列表排序和分页逻辑编写属性基测试
    - **Property 9: 活动列表按创建时间降序排列**
    - **Property 10: 分页逻辑正确性**
    - **Validates: Requirements 5.5, 5.6**

- [x] 5. Checkpoint - 确保云函数测试通过
  - 确保所有测试通过，ask the user if questions arise.

- [x] 6. 实现 credit-badge 组件
  - [x] 6.1 实现 `getColorClass(score)` 纯函数和组件完整代码（JS/WXML/WXSS）
    - `getColorClass`：score >= 100 → 'credit-success'，score >= 80 → 'credit-primary'，score >= 60 → 'credit-warning'，score < 60 → 'credit-danger'
    - WXML：显示"契约分 XXX"格式
    - WXSS：四种颜色 class 样式（成功色/主色/警告色/危险色）
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  - [x]* 6.2 为 `getColorClass` 编写属性基测试
    - **Property 11: 信用徽章颜色映射正确性**
    - **Validates: Requirements 6.2, 6.3, 6.4, 6.5**

- [x] 7. 实现用户个人中心页面
  - [x] 7.1 实现 `pages/user/profile/profile` 页面完整代码（JS/WXML/WXSS/JSON）
    - JS：onShow 调用 getCreditInfo，loadCreditInfo 方法，goToHistory 导航方法，goToSettings 占位方法
    - WXML：信用分大字号展示、守约/违约次数、信用等级描述、三个导航入口（我发起的活动/我参与的活动/设置）
    - WXSS：页面样式（信用分卡片、导航列表）
    - JSON：引用 credit-badge 组件
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [x] 8. 实现历史活动页面
  - [x] 8.1 实现 `pages/user/history/history` 页面完整代码（JS/WXML/WXSS/JSON）
    - JS：onLoad 接收 role 参数，loadActivities 方法，onPullDownRefresh 下拉刷新，onReachBottom 上拉加载更多
    - WXML：活动列表（标题、状态标签、创建时间），参与者角色额外显示参与状态，空状态"还没有活动记录"
    - WXSS：列表样式、状态标签样式、空状态样式
    - JSON：enablePullDownRefresh 配置
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

- [x] 9. 最终 Checkpoint - 验证信用分系统完整性
  - 确保所有测试通过，页面和组件代码无语法错误，ask the user if questions arise.

## 备注

- 标记 `*` 的任务为可选测试任务，可跳过以加速 MVP
- 每个任务引用具体需求编号以确保可追溯性
- 属性基测试使用 fast-check 库，与 Jest 集成，每个属性测试最少 100 次迭代
- 纯函数（calculateNewScore、calculateStatus、getCreditLevel、getColorClass）从模块中导出以便独立测试
