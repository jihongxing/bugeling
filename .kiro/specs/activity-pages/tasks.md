# 实现计划：活动页面与组件

## 概述

将活动管理前端的 4 个页面和 2 个组件设计转化为可执行的编码任务。每个任务递增构建，先实现共享工具函数和组件，再逐个实现页面，最后集成验证。所有代码使用 JavaScript（微信小程序原生开发）。

依赖 Spec 1（project-scaffold）已创建的项目结构、全局样式和工具模块，以及 Spec 2（activity-crud）已实现的后端云函数。

## 任务

- [x] 1. 创建共享工具函数模块
  - [x] 1.1 创建 `miniprogram/utils/format.js`，实现 `formatDeposit(amountInCents)` 函数（分转元，返回 "¥X.X" 格式）和 `formatMeetTime(isoString)` 函数（返回"今天 HH:MM"/"明天 HH:MM"/"MM-DD HH:MM" 格式）和 `formatDistance(meters)` 函数（<1000m 显示 Xm，>=1000m 显示 X.Xkm）
    - _Requirements: 6.2, 5.2_
  - [x] 1.2 创建 `miniprogram/utils/status.js`，导出 `STATUS_MAP` 常量对象（pending/confirmed/verified/expired/settled 到 label/bgColor/textColor 的映射）和 `getStatusConfig(status)` 函数
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  - [x]* 1.3 为 `formatDeposit` 编写属性基测试
    - **Property 1: 押金金额格式化正确性**
    - **Validates: Requirements 6.2**
  - [x]* 1.4 为 `STATUS_MAP` 编写属性基测试
    - **Property 6: 状态标签映射完整性**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**

- [x] 2. 实现 Deposit_Tag 组件
  - [x] 2.1 实现 `miniprogram/components/deposit-tag/deposit-tag`（js/wxml/wxss/json），接收 amount 属性（Number，分），使用 `formatDeposit` 格式化显示，样式为主色背景（#FF6B35）、白色文字、8rpx 圆角
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 3. 实现 Activity_Card 组件
  - [x] 3.1 实现 `miniprogram/components/activity-card/activity-card`（js/wxml/wxss/json），接收 activity 对象属性，显示标题、押金（使用 Deposit_Tag）、参与人数、距离、见面时间、契约分，点击触发 tap 事件传递 activityId
    - 引用 Deposit_Tag 组件
    - 使用 `formatDistance` 和 `formatMeetTime` 格式化显示
    - 样式：白色卡片、16rpx 圆角、24rpx 内边距、阴影
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 4. Checkpoint - 确保组件和工具模块完整
  - 确保所有组件渲染正常、工具函数逻辑正确，ask the user if questions arise.

- [x] 5. 实现首页活动列表页面
  - [x] 5.1 实现 `miniprogram/pages/index/index`（js/wxml/wxss/json），包含：页面配置引用 activity-card 组件并启用下拉刷新、onLoad 调用 location.getCurrentLocation 获取位置、顶部显示位置名称和刷新按钮、调用 api.callFunction('getActivityList') 获取列表、使用 activity-card 渲染列表、空状态显示"附近暂无活动，去发起一个？"、点击卡片 navigateTo 活动详情页
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.7, 1.8_
  - [x] 5.2 实现分页逻辑：onPullDownRefresh 重置 page=1 并重新加载、onReachBottom 在 hasMore 为 true 时 page++ 追加加载
    - _Requirements: 1.5, 1.6_
  - [x]* 5.3 为分页状态管理编写属性基测试
    - **Property 4: 分页状态管理正确性**
    - **Validates: Requirements 1.6**

- [x] 6. 实现创建活动页面
  - [x] 6.1 创建 `miniprogram/pages/activity/create/validate.js`，实现 `validateForm(data)` 函数，校验所有必填字段（title 2-50 字符、location 非空、meetTime 非空、depositTier 非零、identityHint 2-100 字符、wechatId 非空），返回错误消息数组
    - _Requirements: 2.5, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  - [x] 6.2 创建 `miniprogram/pages/activity/create/helpers.js`，实现 `getMinMeetTime(now)` 函数（返回 now + 2 小时的日期字符串）和 `buildCreateRequest(formData)` 函数（表单数据转 API 请求参数）
    - _Requirements: 2.3_
  - [x] 6.3 实现 `miniprogram/pages/activity/create/create`（js/wxml/wxss/json），包含：表单字段（主题、地点 POI 选择、时间选择器、人数步进器、押金单选组、接头特征、微信号）、押金选中态主色填充、提交校验 → loading → callFunction('createActivity') → 成功导航到详情页、错误码 2001/2002 toast 处理
    - _Requirements: 2.1, 2.2, 2.4, 2.6, 2.7, 2.8, 2.9_
  - [x]* 6.4 为 `validateForm` 编写属性基测试
    - **Property 2: 表单校验完整性**
    - **Validates: Requirements 2.5, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6**
  - [x]* 6.5 为 `getMinMeetTime` 编写属性基测试
    - **Property 5: 最小可选时间计算正确性**
    - **Validates: Requirements 2.3**

- [x] 7. Checkpoint - 确保首页和创建页功能完整
  - 确保首页列表加载、分页、创建活动表单校验和提交流程正常，ask the user if questions arise.

- [x] 8. 实现活动详情页面
  - [x] 8.1 创建 `miniprogram/pages/activity/detail/helpers.js`，实现 `getActionState(isInitiator, myParticipation)` 函数（返回 'manage'/'status'/'join'）
    - _Requirements: 3.5, 3.6, 3.7_
  - [x] 8.2 实现 `miniprogram/pages/activity/detail/detail`（js/wxml/wxss/json），包含：onLoad 获取 activityId 并调用 getActivityDetail、显示活动标题/契约分/地点/时间/人数/接头特征、押金金额卡片（40rpx Bold）、契约声明区域（浅黄背景 #FEF3C7 + 边框 #F59E0B）、根据 getActionState 显示对应按钮（报名/状态/管理）、wechatId 非 null 时显示"复制发起人微信"按钮调用 wx.setClipboardData
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_
  - [x]* 8.3 为 `getActionState` 编写属性基测试
    - **Property 3: 按钮状态决策正确性**
    - **Validates: Requirements 3.5, 3.6, 3.7**

- [x] 9. 实现活动管理页面
  - [x] 9.1 创建 `miniprogram/pages/activity/manage/helpers.js`，实现 `shouldShowActions(participation)` 函数（仅 status 为 'paid' 时返回 true）
    - _Requirements: 4.4_
  - [x] 9.2 实现 `miniprogram/pages/activity/manage/manage`（js/wxml/wxss/json），包含：onLoad 获取 activityId 并加载活动详情、顶部显示活动基本信息和当前/最大参与人数、参与者列表显示状态标签（使用 STATUS_MAP）、paid 状态显示"同意"/"拒绝"按钮、同意调用 approveParticipant 并刷新、拒绝调用 rejectParticipant 并刷新、失败显示 toast 错误信息
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_
  - [x]* 9.3 为 `shouldShowActions` 编写属性基测试
    - **Property 7: 参与者操作按钮显示规则**
    - **Validates: Requirements 4.4**

- [x] 10. 最终 Checkpoint - 验证所有页面和组件功能完整
  - 确保 4 个页面和 2 个组件全部实现、页面间导航正确、状态标签显示正确，ask the user if questions arise.

## 备注

- 标记 `*` 的任务为可选测试任务，可跳过以加速 MVP
- 每个任务引用具体需求编号以确保可追溯性
- 属性基测试使用 fast-check 库，与 Jest 集成，每个属性测试最少 100 次迭代
- 报名支付按钮（"支付 ¥XX.X 报名"）在本 Spec 中仅显示按钮，实际支付逻辑由 Spec 4 实现
- 所有页面样式使用 Spec 1 定义的全局 CSS 变量
