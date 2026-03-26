# 实现计划：活动日历与信用海报

## 概述

将活动日历和信用海报设计转化为可执行的编码任务。先实现共享模块和云函数，再实现前端页面，最后集成冲突检测和导航更新。所有代码使用 JavaScript（微信小程序原生开发 + 云函数 Node.js）。

依赖 Spec 1（project-scaffold）的项目结构和工具模块，Spec 2（activity-crud）的数据模型和 `_shared/db.js`、`_shared/response.js`，Spec 3（activity-pages）的 `utils/format.js`、`utils/status.js` 和活动详情页，Spec 6（credit-system）的 `_shared/credit.js`。

## 任务

- [x] 1. 创建共享模块和日期工具
  - [x] 1.1 创建 `cloudfunctions/_shared/distance.js`，实现 `haversineDistance(lat1, lon1, lat2, lon2)` 函数，使用 Haversine 公式计算两点间球面距离（返回米）
    - _Requirements: 2.4_
  - [x] 1.2 创建 `cloudfunctions/_shared/calendar.js`，实现 `mapCalendarStatus(activityStatus, participationStatus, meetTime, role)` 纯函数（返回 'verified'/'upcoming'/'breached'/'cancelled'）、`CALENDAR_COLORS` 常量和 `queryMonthActivities(db, openId, year, month)` 查询函数
    - _Requirements: 1.2, 1.3, 1.4, 1.5_
  - [x] 1.3 创建 `miniprogram/utils/date.js`，实现 `getMonthDays(year, month)`、`getFirstDayOfWeek(year, month)`、`isToday(year, month, day)`、`formatDateKey(year, month, day)` 四个日期工具函数
    - _Requirements: 3.3_
  - [x]* 1.4 为 `haversineDistance` 编写属性基测试
    - **Property 6: Haversine 距离计算基本性质**
    - **Validates: Requirements 2.4**
  - [x]* 1.5 为 `mapCalendarStatus` 编写属性基测试
    - **Property 1: 日历状态颜色映射完整性**
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5**
  - [x]* 1.6 为 `getMonthDays` 和 `formatDateKey` 编写属性基测试
    - **Property 10: 日历天数计算正确性**
    - **Property 2: 日期分组键格式正确性**
    - **Validates: Requirements 1.1, 3.3**

- [x] 2. 实现 getCalendarActivities 云函数
  - [x] 2.1 创建 `cloudfunctions/getCalendarActivities/` 目录，包含 `index.js` 和 `package.json`（依赖 wx-server-sdk），实现：参数校验（year/month）、调用 `queryMonthActivities` 查询月度活动、按日期分组并计算 `mapCalendarStatus`、计算月度统计摘要（totalActivities、verifiedCount、breachedCount、complianceRate、totalCompensation、plannedExpense）、查询 transactions 集合计算补偿金额、返回 `{ days, summary }`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_
  - [x]* 2.2 为守约率计算编写属性基测试
    - **Property 3: 守约率计算正确性**
    - **Validates: Requirements 1.6, 1.7**

- [x] 3. 实现 checkConflict 云函数
  - [x] 3.1 创建 `cloudfunctions/checkConflict/` 目录，包含 `index.js` 和 `package.json`，实现：参数校验（meetTime/activityLocation）、`hasTimeOverlap(start1, end1, start2, end2)` 纯函数、`getGapMinutes(start1, end1, start2, end2)` 纯函数、查询用户待进行活动（发起人 + 参与者）、遍历检测时间重叠和路程风险（间隔 < 60min 且距离 > 5km）、返回 `{ hasConflict, hasRouteRisk, conflicts, routeWarning }`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [x]* 3.2 为 `hasTimeOverlap` 编写属性基测试
    - **Property 4: 时间段重叠检测正确性**
    - **Validates: Requirements 2.2**
  - [x]* 3.3 为 `getGapMinutes` 编写属性基测试
    - **Property 5: 时间段间隔计算正确性**
    - **Validates: Requirements 2.3**

- [x] 4. 实现 getPosterData 云函数
  - [x] 4.1 创建 `cloudfunctions/getPosterData/` 目录，包含 `index.js` 和 `package.json`，实现：参数校验、调用 `queryMonthActivities` 查询月度活动、计算 calendarDots（日期到颜色映射）、调用 `getCredit` 获取信用分、查询 credits 集合计算 beatPercent、`generateSlogan(verifiedCount, breachedCount, month)` 纯函数、返回海报数据
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - [x]* 4.2 为 `generateSlogan` 编写属性基测试
    - **Property 8: 海报文案生成正确性**
    - **Validates: Requirements 4.3, 4.4**
  - [x]* 4.3 为击败百分比计算编写属性基测试
    - **Property 9: 击败百分比计算正确性**
    - **Validates: Requirements 4.2**

- [x] 5. Checkpoint - 确保云函数和共享模块完整
  - 确保所有云函数参数校验、数据查询和计算逻辑正确，ask the user if questions arise.

- [x] 6. 实现日历页面
  - [x] 6.1 在 `miniprogram/app.json` 中注册 `pages/user/calendar/calendar` 页面路由
    - _Requirements: 3.1_
  - [x] 6.2 创建 `miniprogram/pages/user/calendar/calendar`（js/json/wxml/wxss），实现：onLoad 初始化当前年月并调用 `loadCalendarData`、`buildCalendarGrid` 构建日历网格（含前置空白填充和状态圆点数据）、`loadTodayActivities` 过滤今日待进行活动、`onSwipeLeft`/`onSwipeRight` 月份切换（含年份进位/借位）、`onDateTap` 点击日期展开活动列表、顶部显示守约率和累计补偿、底部显示已计划支出、今日任务置顶区域（含地点、接头特征、复制微信按钮）、"分享守约月报"按钮导航到海报页
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_
  - [x]* 6.3 为月份切换逻辑编写属性基测试
    - **Property 7: 月份切换逻辑正确性**
    - **Validates: Requirements 3.3**

- [x] 7. 实现海报页面
  - [x] 7.1 在 `miniprogram/app.json` 中注册 `pages/user/poster/poster` 页面路由
    - _Requirements: 5.1_
  - [x] 7.2 创建 `miniprogram/pages/user/poster/poster`（js/json/wxml/wxss），实现：onLoad 接收 year/month 参数并调用 `loadPosterData`、使用 Canvas 2D API（`type="2d"`）绘制海报（背景、标题、日历缩略图含颜色点、统计文案、契约分、击败百分比、品牌标识）、`savePoster` 方法调用 `wx.canvasToTempFilePath` + `wx.saveImageToPhotosAlbum`（含权限拒绝处理引导用户前往设置页）、`onShareAppMessage` 配置微信分享
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 8. Checkpoint - 确保日历和海报页面功能完整
  - 确保日历月视图渲染、月份切换、日期点击展开、今日任务显示、海报绘制和保存功能正常，ask the user if questions arise.

- [x] 9. 集成冲突检测和导航更新
  - [x] 9.1 修改 `miniprogram/pages/activity/detail/detail.js`，在报名按钮点击处理中增加冲突检测逻辑：调用 `checkConflict` → hasConflict 时显示冲突警告模态框 → hasRouteRisk 时显示路程风险模态框 → 用户确认后继续 `createDeposit` 流程 → 用户取消则中止 → checkConflict 调用失败时不阻塞报名
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - [x] 9.2 修改 `miniprogram/pages/user/profile/profile`（js/wxml），新增"我的契约日程"导航入口（跳转 calendar 页）和"守约月报海报"导航入口（跳转 poster 页，传递当前年月参数）
    - _Requirements: 7.1, 7.2_

- [x] 10. 最终 Checkpoint - 验证所有功能集成完整
  - 确保云函数、日历页、海报页、冲突检测集成和导航入口全部正常工作，ask the user if questions arise.

## 备注

- 标记 `*` 的任务为可选测试任务，可跳过以加速 MVP
- 每个任务引用具体需求编号以确保可追溯性
- 属性基测试使用 fast-check 库，与 Jest 集成，每个属性测试最少 100 次迭代
- 所有页面样式使用 Spec 1 定义的全局 CSS 变量
- Canvas 海报使用新版 Canvas 2D API（`type="2d"`），需微信基础库 2.9.0+
- `_shared/distance.js` 可被 Spec 7（自动仲裁）复用
