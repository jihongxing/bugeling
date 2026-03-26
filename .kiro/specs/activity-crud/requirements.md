# 需求文档 - 活动 CRUD 云函数

## 简介

本需求定义"不鸽令"微信小程序的活动管理后端功能，包含 5 个核心云函数（createActivity、getActivityList、getActivityDetail、approveParticipant、rejectParticipant）及相关数据库索引。本 Spec 仅涉及后端云函数逻辑，不包含前端页面（前端为 Spec 3）。

本 Spec 依赖 Spec 1（project-scaffold）提供的项目目录结构和共享模块（`_shared/db.js`、`_shared/config.js`、`_shared/credit.js`）。

## 术语表

- **活动 (Activity)**：发起人创建的线下约见契约，包含主题、地点、时间、鸽子费等信息，存储在 `activities` 集合中
- **发起人 (Initiator)**：创建活动的用户，通过 `initiatorId`（openId）标识
- **参与者 (Participant)**：报名并支付押金的用户，其参与记录存储在 `participations` 集合中
- **鸽子费 (Deposit)**：参与者预缴的押金，以"分"为单位存储，枚举值为 990/1990/2990/3990/4990
- **信用分 (Credit_Score)**：用户的履约信用评分，初始 100 分，存储在 `credits` 集合中
- **内容安全检查 (MsgSecCheck)**：微信提供的 `cloud.openapi.security.msgSecCheck` 接口，用于检测文本是否包含违规内容
- **GEO 查询 (GEO_Query)**：云数据库基于 2dsphere 地理位置索引的范围查询，用于查找指定半径内的活动
- **参与记录 (Participation)**：记录参与者与活动的关联关系及状态，存储在 `participations` 集合中
- **云函数上下文 (WX_Context)**：通过 `cloud.getWXContext()` 获取的调用者身份信息，包含 `OPENID` 字段
- **活动状态 (Activity_Status)**：活动的生命周期状态，枚举值为 `pending`（待组队）/ `confirmed`（已成行）/ `verified`（已核销）/ `expired`（已超时）/ `settled`（已结算）
- **参与状态 (Participation_Status)**：参与记录的状态，枚举值为 `paid`（已支付）/ `approved`（已通过）/ `rejected`（已拒绝）/ `verified`（已核销）/ `breached`（违约）/ `refunded`（已退款）

## 需求

### 需求 1：创建活动（createActivity）

**用户故事：** 作为发起人，我希望创建一个线下约见活动，以便其他用户可以报名参与。

#### 验收标准

1. WHEN 调用 createActivity 云函数时，THE createActivity SHALL 通过 `cloud.getWXContext().OPENID` 获取调用者身份作为 `initiatorId`
2. WHEN 接收到请求参数时，THE createActivity SHALL 校验以下字段：`title` 为字符串且长度 2-50 字符、`depositTier` 为枚举值 990/1990/2990/3990/4990 之一、`maxParticipants` 为整数且范围 1-20、`location` 为包含 `name`(string)、`address`(string)、`latitude`(number)、`longitude`(number) 的对象、`meetTime` 为有效 ISO 8601 时间字符串、`identityHint` 为字符串且长度 2-100 字符、`wechatId` 为非空字符串
3. IF 任一参数校验失败，THEN THE createActivity SHALL 返回错误码 1001 和具体的校验失败原因
4. WHEN `meetTime` 距当前时间不足 2 小时时，THE createActivity SHALL 返回错误码 1001 并说明见面时间必须晚于当前时间 2 小时
5. WHEN 参数校验通过后，THE createActivity SHALL 调用 `cloud.openapi.security.msgSecCheck` 分别检查 `title` 和 `identityHint` 的内容安全
6. IF 内容安全检查未通过，THEN THE createActivity SHALL 返回错误码 2001
7. WHEN 内容安全检查通过后，THE createActivity SHALL 查询调用者的信用分记录
8. IF 调用者信用分低于 60，THEN THE createActivity SHALL 返回错误码 2002 并说明信用分不足
9. WHILE 调用者信用分低于 80，THE createActivity SHALL 检查该用户当日已创建的活动数量，若已达 1 次则返回错误码 2002 并说明低信用用户每日限创建 1 次
10. WHEN 所有校验通过后，THE createActivity SHALL 在 `activities` 集合中创建一条记录，包含 `initiatorId`、`title`、`depositTier`、`maxParticipants`、`location`（GEO Point 格式）、`meetTime`、`identityHint`、`wechatId`、`status` 设为 `pending`、`currentParticipants` 设为 0、`createdAt` 设为当前服务器时间
11. WHEN 活动记录创建成功后，THE createActivity SHALL 返回 `{ code: 0, data: { activityId } }`

### 需求 2：获取附近活动列表（getActivityList）

**用户故事：** 作为用户，我希望浏览附近的活动列表，以便找到感兴趣的线下约见。

#### 验收标准

1. WHEN 调用 getActivityList 云函数时，THE getActivityList SHALL 接收 `latitude`(number, 必填)、`longitude`(number, 必填)、`radius`(number, 可选, 默认 20000 米)、`page`(number, 可选, 默认 1)、`pageSize`(number, 可选, 默认 20, 最大 50) 参数
2. IF `latitude` 或 `longitude` 缺失或非数值类型，THEN THE getActivityList SHALL 返回错误码 1001
3. WHEN 参数有效时，THE getActivityList SHALL 使用云数据库 GEO 查询（`db.command.geoNear`），以传入的经纬度为圆心、`radius` 为半径，查询 `activities` 集合中 `status` 为 `pending` 的活动
4. THE getActivityList SHALL 按距离升序排列查询结果
5. THE getActivityList SHALL 对查询结果进行分页，根据 `page` 和 `pageSize` 返回对应页的数据
6. WHEN 返回活动列表时，THE getActivityList SHALL 为每条活动记录包含以下字段：`activityId`、`title`、`depositTier`、`maxParticipants`、`currentParticipants`、`location`（含 `name`、`latitude`、`longitude`）、`distance`（距用户距离，单位米）、`meetTime`、`initiatorCredit`（发起人信用分）、`status`
7. THE getActivityList SHALL 返回分页信息：`total`（总条数）、`hasMore`（是否有下一页）

### 需求 3：获取活动详情（getActivityDetail）

**用户故事：** 作为用户，我希望查看活动的完整详情，以便决定是否参与。

#### 验收标准

1. WHEN 调用 getActivityDetail 云函数时，THE getActivityDetail SHALL 接收 `activityId`(string, 必填) 参数
2. IF `activityId` 缺失或为空，THEN THE getActivityDetail SHALL 返回错误码 1001
3. IF 指定的活动记录不存在，THEN THE getActivityDetail SHALL 返回错误码 1003
4. WHEN 活动记录存在时，THE getActivityDetail SHALL 返回完整的活动信息：`activityId`、`title`、`depositTier`、`maxParticipants`、`currentParticipants`、`location`、`meetTime`、`identityHint`、`initiatorCredit`、`status`
5. WHEN 调用者是该活动的已 `approved` 参与者且距 `meetTime` 不超过 2 小时时，THE getActivityDetail SHALL 返回解密后的 `wechatId`
6. WHEN 调用者不满足微信号解锁条件时，THE getActivityDetail SHALL 返回 `wechatId` 为 `null`
7. WHEN 调用者在该活动的 `participations` 集合中存在记录时，THE getActivityDetail SHALL 在响应中包含 `myParticipation` 字段（含参与记录的 `_id`、`status`、`createdAt`）
8. WHEN 调用者在该活动中无参与记录时，THE getActivityDetail SHALL 返回 `myParticipation` 为 `null`

### 需求 4：同意参与者（approveParticipant）

**用户故事：** 作为发起人，我希望审批已支付押金的参与者，以便组队成功开始活动。

#### 验收标准

1. WHEN 调用 approveParticipant 云函数时，THE approveParticipant SHALL 接收 `activityId`(string, 必填) 和 `participationId`(string, 必填) 参数
2. IF `activityId` 或 `participationId` 缺失，THEN THE approveParticipant SHALL 返回错误码 1001
3. IF 指定的活动记录不存在，THEN THE approveParticipant SHALL 返回错误码 1003
4. IF 调用者的 openId 与活动的 `initiatorId` 不匹配，THEN THE approveParticipant SHALL 返回错误码 1002
5. IF 指定的参与记录不存在，THEN THE approveParticipant SHALL 返回错误码 1003
6. IF 参与记录的 `status` 不为 `paid`，THEN THE approveParticipant SHALL 返回错误码 1004
7. IF 活动的 `currentParticipants` 已达到 `maxParticipants`，THEN THE approveParticipant SHALL 返回错误码 1004 并说明参与人数已满
8. WHEN 所有校验通过后，THE approveParticipant SHALL 将参与记录的 `status` 更新为 `approved`，并将活动的 `currentParticipants` 加 1
9. WHEN 该活动首次有参与者被同意时，THE approveParticipant SHALL 将活动的 `status` 从 `pending` 更新为 `confirmed`
10. WHEN 操作成功后，THE approveParticipant SHALL 返回 `{ code: 0, data: { success: true } }`

### 需求 5：拒绝参与者（rejectParticipant）

**用户故事：** 作为发起人，我希望拒绝不合适的参与者，以便筛选合适的约见对象。

#### 验收标准

1. WHEN 调用 rejectParticipant 云函数时，THE rejectParticipant SHALL 接收 `activityId`(string, 必填) 和 `participationId`(string, 必填) 参数
2. IF `activityId` 或 `participationId` 缺失，THEN THE rejectParticipant SHALL 返回错误码 1001
3. IF 指定的活动记录不存在，THEN THE rejectParticipant SHALL 返回错误码 1003
4. IF 调用者的 openId 与活动的 `initiatorId` 不匹配，THEN THE rejectParticipant SHALL 返回错误码 1002
5. IF 指定的参与记录不存在，THEN THE rejectParticipant SHALL 返回错误码 1003
6. IF 参与记录的 `status` 不为 `paid`，THEN THE rejectParticipant SHALL 返回错误码 1004
7. WHEN 所有校验通过后，THE rejectParticipant SHALL 将参与记录的 `status` 更新为 `rejected`
8. WHEN 参与记录状态更新为 `rejected` 后，THE rejectParticipant SHALL 触发全额退款流程（调用 `_shared/pay.js` 的 `refund` 方法）
9. WHEN 操作成功后，THE rejectParticipant SHALL 返回 `{ code: 0, data: { success: true } }`

### 需求 6：数据库索引

**用户故事：** 作为开发者，我希望数据库建立正确的索引，以便 GEO 查询和状态查询具备良好的性能。

#### 验收标准

1. THE 云数据库 SHALL 在 `activities` 集合的 `location` 字段上建立 `2dsphere` 地理位置索引
2. THE 云数据库 SHALL 在 `activities` 集合上建立 `status` + `meetTime` 复合索引
3. THE 云数据库 SHALL 在 `participations` 集合上建立 `activityId` + `status` 复合索引
