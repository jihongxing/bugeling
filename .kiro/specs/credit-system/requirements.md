# 需求文档 - 信用分系统

## 简介

本需求定义"不鸽令"微信小程序的信用分系统完整实现，包括：`_shared/credit.js` 共享模块的完整实现（替换 Spec 1 的骨架代码）、`getCreditInfo` 和 `getMyActivities` 两个云函数、`credit-badge` 组件的完整实现、用户个人中心页面和历史活动页面。

信用分系统是平台履约保障的核心机制，通过量化用户的守约行为来激励诚信、惩罚违约。

本 Spec 依赖 Spec 1（project-scaffold）提供的项目目录结构、`_shared/db.js`、`_shared/config.js`、`utils/api.js`、`credit-badge` 组件骨架和页面骨架。依赖 Spec 2（activity-crud）提供的活动数据模型和 `_shared/response.js` 统一响应模块。

## 术语表

- **信用分 (Credit_Score)**：用户的履约信用评分，初始 100 分，存储在 `credits` 集合中，字段名为 `score`
- **信用记录 (Credit_Record)**：`credits` 集合中的一条文档，包含 `score`、`totalVerified`、`totalBreached`、`status`、`updatedAt` 字段
- **信用状态 (Credit_Status)**：基于信用分的用户状态，枚举值为 `active`（≥ 80 分）/ `restricted`（60-79 分）/ `banned`（< 60 分）
- **信用等级 (Credit_Level)**：信用分对应的描述文案，枚举值为"信用极好"（≥ 100）/"信用良好"（80-99）/"信用一般"（60-79）/"信用较差"（< 60）
- **分数变化量 (Delta)**：信用分的增减值，正数为加分（如 +2 核销成功），负数为扣分（如 -20 违约、-30 举报核实、-5 互鸽）
- **变更原因 (Reason)**：信用分变更的原因标识，枚举值为 `verified`（核销成功）/ `breached`（违约）/ `reported`（举报核实）/ `mutual_noshow`（互鸽）
- **信用徽章 (Credit_Badge)**：显示用户信用分的小程序自定义组件，根据分数显示不同颜色
- **活动角色 (Activity_Role)**：用户在活动中的角色，枚举值为 `initiator`（发起人）/ `participant`（参与者）
- **云函数上下文 (WX_Context)**：通过 `cloud.getWXContext()` 获取的调用者身份信息，包含 `OPENID` 字段

## 需求

### 需求 1：获取用户信用分（getCredit）

**用户故事：** 作为系统内部模块，我希望获取指定用户的信用分记录，以便在各业务场景中查询和展示信用信息。

#### 验收标准

1. WHEN 调用 `getCredit(openId)` 且 `credits` 集合中存在该 openId 的记录时，THE Credit_Module SHALL 返回该记录的 `{ score, totalVerified, totalBreached, status }` 字段
2. WHEN 调用 `getCredit(openId)` 且 `credits` 集合中不存在该 openId 的记录时，THE Credit_Module SHALL 自动创建一条新记录，`score` 设为 100、`totalVerified` 设为 0、`totalBreached` 设为 0、`status` 设为 `active`，并返回该新记录
3. IF `openId` 参数为空或非字符串类型，THEN THE Credit_Module SHALL 抛出参数校验错误

### 需求 2：更新用户信用分（updateCredit）

**用户故事：** 作为系统内部模块，我希望根据用户的履约或违约行为更新信用分，以便信用体系准确反映用户行为。

#### 验收标准

1. WHEN 调用 `updateCredit(openId, delta, reason)` 时，THE Credit_Module SHALL 将用户的 `score` 更新为 `当前 score + delta`
2. IF 更新后的 `score` 计算结果小于 0，THEN THE Credit_Module SHALL 将 `score` 设为 0
3. WHEN `delta` 为正数且 `reason` 为 `verified` 时，THE Credit_Module SHALL 将 `totalVerified` 加 1
4. WHEN `delta` 为负数且 `reason` 为 `breached` 时，THE Credit_Module SHALL 将 `totalBreached` 加 1
5. WHEN 信用分更新完成后，THE Credit_Module SHALL 根据新的 `score` 值重新计算 `status`：`score` < 60 设为 `banned`、`score` < 80 设为 `restricted`、`score` ≥ 80 设为 `active`
6. WHEN 信用分更新完成后，THE Credit_Module SHALL 记录 `updatedAt` 为当前服务器时间
7. WHEN 更新操作完成后，THE Credit_Module SHALL 返回更新后的完整信用记录

### 需求 3：检查用户访问权限（checkAccess）

**用户故事：** 作为系统内部模块，我希望检查用户是否有权使用平台功能，以便在操作前进行权限拦截。

#### 验收标准

1. WHEN 调用 `checkAccess(openId)` 且用户 `score` ≥ 80 时，THE Credit_Module SHALL 返回 `{ allowed: true, reason: '', score }`
2. WHEN 调用 `checkAccess(openId)` 且用户 `score` 在 [60, 80) 区间时，THE Credit_Module SHALL 返回 `{ allowed: true, reason: '信用分较低，部分功能受限', score }`
3. WHEN 调用 `checkAccess(openId)` 且用户 `score` < 60 时，THE Credit_Module SHALL 返回 `{ allowed: false, reason: '信用分不足，禁止使用平台', score }`

### 需求 4：获取信用信息云函数（getCreditInfo）

**用户故事：** 作为用户，我希望查看自己的信用分详情，以便了解自己的信用状况。

#### 验收标准

1. WHEN 调用 getCreditInfo 云函数时，THE getCreditInfo SHALL 通过 `cloud.getWXContext().OPENID` 获取调用者身份
2. WHEN 获取到调用者 openId 后，THE getCreditInfo SHALL 调用 `credit.getCredit(openId)` 获取信用记录
3. WHEN 获取到信用记录后，THE getCreditInfo SHALL 根据 `score` 计算信用等级描述：`score` ≥ 100 返回"信用极好"、`score` ≥ 80 返回"信用良好"、`score` ≥ 60 返回"信用一般"、`score` < 60 返回"信用较差"
4. WHEN 处理完成后，THE getCreditInfo SHALL 返回 `{ code: 0, data: { score, totalVerified, totalBreached, status, level } }`

### 需求 5：获取我的活动云函数（getMyActivities）

**用户故事：** 作为用户，我希望查看自己发起或参与的活动历史，以便回顾和管理我的活动记录。

#### 验收标准

1. WHEN 调用 getMyActivities 云函数时，THE getMyActivities SHALL 接收可选参数 `role`（枚举值 `initiator` / `participant`，不传则查询全部）、`page`（默认 1）、`pageSize`（默认 20）
2. WHEN `role` 为 `initiator` 时，THE getMyActivities SHALL 查询 `activities` 集合中 `initiatorId` 等于调用者 openId 的记录
3. WHEN `role` 为 `participant` 时，THE getMyActivities SHALL 先查询 `participations` 集合中 `participantId` 等于调用者 openId 的记录，再关联查询对应的活动信息
4. WHEN `role` 未传入时，THE getMyActivities SHALL 合并发起人和参与者两种角色的活动记录
5. THE getMyActivities SHALL 按 `createdAt` 降序排列查询结果
6. THE getMyActivities SHALL 对查询结果进行分页，根据 `page` 和 `pageSize` 返回对应页的数据
7. WHEN `role` 为 `participant` 时，THE getMyActivities SHALL 在每条活动记录中附带该用户的参与状态（`participationStatus` 字段）
8. WHEN 处理完成后，THE getMyActivities SHALL 返回 `{ code: 0, data: { list, total, hasMore } }`

### 需求 6：信用徽章组件（credit-badge）

**用户故事：** 作为用户，我希望在界面上直观看到信用分数值和对应的颜色标识，以便快速了解信用状况。

#### 验收标准

1. THE Credit_Badge 组件 SHALL 接收 `score`（Number 类型）作为组件属性
2. WHEN `score` ≥ 100 时，THE Credit_Badge SHALL 以成功色（#10B981）显示分数
3. WHEN `score` 在 [80, 100) 区间时，THE Credit_Badge SHALL 以主色（#FF6B35）显示分数
4. WHEN `score` 在 [60, 80) 区间时，THE Credit_Badge SHALL 以警告色（#F59E0B）显示分数
5. WHEN `score` < 60 时，THE Credit_Badge SHALL 以危险色（#EF4444）显示分数
6. THE Credit_Badge SHALL 以"契约分 XXX"格式显示，其中 XXX 为实际分数值

### 需求 7：用户个人中心页面（profile）

**用户故事：** 作为用户，我希望在个人中心查看信用分概览和快捷导航，以便管理我的账户和活动。

#### 验收标准

1. WHEN 用户进入个人中心页面时，THE Profile_Page SHALL 调用 getCreditInfo 云函数获取信用信息
2. WHEN 信用信息加载完成后，THE Profile_Page SHALL 以大字号突出显示信用分数值
3. WHEN 信用信息加载完成后，THE Profile_Page SHALL 显示累计守约次数（totalVerified）和累计违约次数（totalBreached）
4. WHEN 信用信息加载完成后，THE Profile_Page SHALL 显示信用等级描述（level）
5. THE Profile_Page SHALL 提供"我发起的活动"导航入口，点击后跳转至历史页面并传入 `role=initiator` 参数
6. THE Profile_Page SHALL 提供"我参与的活动"导航入口，点击后跳转至历史页面并传入 `role=participant` 参数
7. THE Profile_Page SHALL 提供"设置"导航入口作为占位项

### 需求 8：历史活动页面（history）

**用户故事：** 作为用户，我希望查看我的活动历史记录，以便回顾过往的约见情况。

#### 验收标准

1. WHEN 进入历史页面时，THE History_Page SHALL 接收可选的 `role` 参数（`initiator` / `participant`）
2. WHEN 页面加载时，THE History_Page SHALL 调用 getMyActivities 云函数并传入 `role` 参数获取活动列表
3. WHEN 活动列表加载完成后，THE History_Page SHALL 显示每条活动的标题、状态标签和创建时间
4. WHEN `role` 为 `participant` 时，THE History_Page SHALL 额外显示用户在该活动中的参与状态
5. WHEN 用户下拉页面时，THE History_Page SHALL 触发刷新操作重新加载数据
6. WHEN 用户上拉至页面底部且存在更多数据时，THE History_Page SHALL 加载下一页数据并追加到列表
7. WHEN 活动列表为空时，THE History_Page SHALL 显示空状态提示"还没有活动记录"
