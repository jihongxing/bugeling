# 需求文档 - 活动日历与信用海报

## 简介

本需求描述"不鸽令"微信小程序中活动日历（契约日程）和信用海报（守约月报）两大功能模块。活动日历以月视图展示用户的所有契约活动，通过颜色编码直观呈现履约状态，并提供冲突检测和今日任务置顶功能。信用海报允许用户将月度守约数据生成可分享的图片，作为信用展示和产品传播载体。

本 Spec 涵盖 3 个云函数（getCalendarActivities、checkConflict、getPosterData）、2 个前端页面（日历页、海报页）、活动详情页冲突检测集成、以及个人中心页面导航更新。

## 术语表

- **Calendar_Page**：活动日历页面（pages/user/calendar/calendar），以月视图展示用户契约日程
- **Poster_Page**：信用海报页面（pages/user/poster/poster），使用 Canvas 绘制可分享的守约月报图片
- **Calendar_Service**：getCalendarActivities 云函数，查询并聚合用户月度活动数据
- **Conflict_Service**：checkConflict 云函数，检测活动时间冲突和路程风险
- **Poster_Service**：getPosterData 云函数，计算海报所需的统计数据
- **Calendar_Status**：日历状态颜色标识，包括 verified（绿）、upcoming（黄）、breached（红）、cancelled（灰）
- **Compliance_Rate**：守约率，计算公式为 verifiedCount / (verifiedCount + breachedCount) × 100
- **Route_Risk**：路程风险，两个活动地点距离较远但时间间隔过短的预警
- **Haversine**：Haversine 公式，用于根据经纬度计算两点间球面距离
- **Beat_Percent**：击败百分比，当前用户信用分超过的用户比例

## 需求

### 需求 1：获取日历活动数据

**用户故事：** 作为用户，我希望按月查看我参与的所有契约活动及其状态，以便掌握自己的履约情况。

#### 验收标准

1. WHEN Calendar_Service 收到 year 和 month 参数, THE Calendar_Service SHALL 查询该月内调用者作为发起人或参与者的所有活动，并按日期（YYYY-MM-DD 格式）分组返回
2. WHEN 活动的参与状态为 verified 或 refunded, THE Calendar_Service SHALL 将该活动的 Calendar_Status 标记为 verified（绿色 #10B981）
3. WHEN 活动状态为 confirmed 且参与状态为 approved 或 paid 且 meetTime 在未来, THE Calendar_Service SHALL 将该活动的 Calendar_Status 标记为 upcoming（黄色 #F59E0B）
4. WHEN 活动的参与状态为 breached 或 settled, THE Calendar_Service SHALL 将该活动的 Calendar_Status 标记为 breached（红色 #EF4444）
5. WHEN 活动状态为 expired 或 cancelled, THE Calendar_Service SHALL 将该活动的 Calendar_Status 标记为 cancelled（灰色 #9CA3AF）
6. THE Calendar_Service SHALL 计算月度统计摘要，包括 totalActivities（活动总数）、verifiedCount（绿色状态数）、breachedCount（红色状态数）、complianceRate（守约率百分比）、totalCompensation（本月累计补偿金额，单位分）、plannedExpense（待进行活动的押金总额，单位分）
7. WHEN verifiedCount 和 breachedCount 均为 0, THE Calendar_Service SHALL 将 complianceRate 设为 0
8. WHEN year 或 month 参数缺失或不合法, THE Calendar_Service SHALL 返回参数校验失败错误（code 1001）

### 需求 2：检查活动时间冲突

**用户故事：** 作为用户，我希望在报名新活动前得到时间冲突和路程风险的提醒，以避免因赶不及而损失多份押金。

#### 验收标准

1. WHEN Conflict_Service 收到 meetTime、duration（默认 120 分钟）和 activityLocation, THE Conflict_Service SHALL 查询调用者所有待进行的活动（状态为 confirmed 或 pending，meetTime 在未来）
2. WHEN 新活动的时间段 [meetTime, meetTime + duration] 与已有活动的时间段 [existingMeetTime, existingMeetTime + 120分钟] 存在重叠, THE Conflict_Service SHALL 将 hasConflict 设为 true 并将冲突活动加入 conflicts 列表
3. WHEN 新活动与已有活动无时间重叠但间隔小于 60 分钟且两地距离超过 5km, THE Conflict_Service SHALL 将 hasRouteRisk 设为 true 并生成路程预警文案
4. THE Conflict_Service SHALL 使用 Haversine 公式计算两个活动地点之间的距离
5. WHEN 无任何冲突和路程风险, THE Conflict_Service SHALL 返回 hasConflict 为 false、hasRouteRisk 为 false、conflicts 为空数组、routeWarning 为 null

### 需求 3：日历页面展示

**用户故事：** 作为用户，我希望通过直观的月视图日历查看我的契约日程，以便快速了解每天的活动安排和履约状态。

#### 验收标准

1. WHEN 用户打开 Calendar_Page, THE Calendar_Page SHALL 以月视图展示当前月份的日历，并在有活动的日期下方显示对应颜色的状态圆点
2. WHEN 同一日期有多个活动, THE Calendar_Page SHALL 在该日期下方显示多个颜色圆点
3. WHEN 用户左右滑动日历, THE Calendar_Page SHALL 切换到上一月或下一月并重新加载该月数据
4. WHEN 用户点击某个日期, THE Calendar_Page SHALL 展开显示该日期的活动列表，包含活动标题、地点、时间和状态
5. WHEN 当天有待进行的活动, THE Calendar_Page SHALL 在日历下方置顶显示今日任务，包含集合地点、接头特征提示和"复制微信"按钮
6. THE Calendar_Page SHALL 在顶部显示本月守约率和累计补偿金额
7. THE Calendar_Page SHALL 在底部显示本月已计划支出金额
8. WHEN 用户点击"分享守约月报"按钮, THE Calendar_Page SHALL 导航到 Poster_Page 并传递当前年月参数

### 需求 4：获取海报数据

**用户故事：** 作为用户，我希望获取我的月度守约统计数据，以便生成可分享的信用海报。

#### 验收标准

1. WHEN Poster_Service 收到 year 和 month 参数, THE Poster_Service SHALL 返回该月的日历颜色点映射（calendarDots）、守约次数（verifiedCount）、违约次数（breachedCount）、当前契约分（creditScore）、击败百分比（beatPercent）和海报文案（slogan）
2. THE Poster_Service SHALL 通过查询 credits 集合中信用分低于当前用户的记录数来计算 beatPercent
3. WHEN 用户本月守约次数大于 0 且违约次数为 0, THE Poster_Service SHALL 生成包含"从未放鸽子"的 slogan
4. WHEN 用户本月有违约记录, THE Poster_Service SHALL 生成包含实际守约和违约次数的 slogan

### 需求 5：海报页面生成与分享

**用户故事：** 作为用户，我希望将月度守约数据生成精美的海报图片并分享到朋友圈，以展示我的契约精神。

#### 验收标准

1. WHEN 用户打开 Poster_Page, THE Poster_Page SHALL 调用 Poster_Service 获取数据并使用 Canvas API 绘制海报
2. THE Poster_Page SHALL 在海报中绘制月度日历缩略图（含颜色状态点）、守约统计文案、契约分数值、击败百分比和"不鸽令"品牌标识
3. WHEN 用户点击"保存图片"按钮, THE Poster_Page SHALL 调用 wx.canvasToTempFilePath 导出图片后调用 wx.saveImageToPhotosAlbum 保存到相册
4. IF 用户未授权相册权限, THEN THE Poster_Page SHALL 提示用户前往设置页开启权限
5. WHEN 用户点击"分享到朋友圈"按钮, THE Poster_Page SHALL 调用微信分享接口发起分享

### 需求 6：活动详情页冲突检测集成

**用户故事：** 作为用户，我希望在报名活动时自动检测时间冲突，以便在知情的情况下做出决策。

#### 验收标准

1. WHEN 用户在活动详情页点击报名（调用 createDeposit 之前）, THE Activity_Detail_Page SHALL 调用 Conflict_Service 检查该活动的 meetTime 和 location 是否与已有活动冲突
2. WHEN Conflict_Service 返回 hasConflict 为 true, THE Activity_Detail_Page SHALL 显示模态框警告"契约冲突！您在那段时间已有一场不鸽令，强行加入若无法准时到达，将损失两份押金。"，用户确认后方可继续报名
3. WHEN Conflict_Service 返回 hasRouteRisk 为 true, THE Activity_Detail_Page SHALL 显示模态框警告路程风险信息，用户确认后方可继续报名
4. WHEN 用户在冲突或路程风险警告中选择取消, THE Activity_Detail_Page SHALL 中止报名流程

### 需求 7：个人中心导航更新

**用户故事：** 作为用户，我希望从个人中心快速进入日历和海报页面，以便方便地查看日程和生成海报。

#### 验收标准

1. THE Profile_Page SHALL 显示"我的契约日程"导航入口，点击后跳转到 Calendar_Page
2. THE Profile_Page SHALL 显示"守约月报海报"导航入口，点击后跳转到 Poster_Page
