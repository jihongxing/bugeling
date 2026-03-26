# API 接口文档 - 不鸽令·线下契约引擎

**调用方式：** `wx.cloud.callFunction({ name, data })`  
**鉴权：** 云函数自动获取调用者 openId（`cloud.getWXContext().OPENID`）  
**金额单位：** 所有金额字段均以"分"为单位（integer）

---

## 通用响应格式

```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

## 通用错误码

| code | 说明 |
|------|------|
| 0 | 成功 |
| 1001 | 参数校验失败 |
| 1002 | 权限不足（非本人操作） |
| 1003 | 资源不存在 |
| 1004 | 状态不允许（如重复操作） |
| 2001 | 内容安全审核未通过 |
| 2002 | 信用分不足，操作受限 |
| 3001 | 微信支付下单失败 |
| 3002 | 微信退款失败 |
| 3003 | 微信分账失败 |
| 4001 | 核销码无效或已过期 |
| 4002 | 核销码与活动不匹配 |
| 5001 | 系统内部错误 |

---

## 1. 活动管理

### 1.1 createActivity — 创建活动

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | 是 | 活动主题，2-50 字符 |
| depositTier | number | 是 | 鸽子费档位，枚举：990 / 1990 / 2990 / 3990 / 4990（分） |
| maxParticipants | number | 是 | 最大人数，1-20 |
| location | object | 是 | `{ name: string, address: string, latitude: number, longitude: number }` |
| meetTime | string | 是 | ISO 8601 格式，必须晚于当前时间 2 小时 |
| identityHint | string | 是 | 接头特征，2-100 字符 |
| wechatId | string | 是 | 发起人微信号，加密存储 |

**响应 data：**

| 字段 | 类型 | 说明 |
|------|------|------|
| activityId | string | 新创建的活动 ID |

**业务规则：**
- 调用 msgSecCheck 审核 title 和 identityHint，不通过返回 2001
- 检查用户信用分，< 80 限制每日发起 1 次，< 60 返回 2002
- meetTime 必须在当前时间 2 小时之后

---

### 1.2 getActivityList — 获取附近活动列表

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| latitude | number | 是 | 用户当前纬度 |
| longitude | number | 是 | 用户当前经度 |
| radius | number | 否 | 搜索半径（米），默认 20000 |
| page | number | 否 | 页码，默认 1 |
| pageSize | number | 否 | 每页条数，默认 20，最大 50 |

**响应 data：**

| 字段 | 类型 | 说明 |
|------|------|------|
| list | array | 活动列表 |
| list[].activityId | string | 活动 ID |
| list[].title | string | 活动主题 |
| list[].depositTier | number | 鸽子费（分） |
| list[].maxParticipants | number | 最大人数 |
| list[].currentParticipants | number | 当前已通过人数 |
| list[].location | object | `{ name, latitude, longitude }` |
| list[].distance | number | 距用户距离（米） |
| list[].meetTime | string | 见面时间 |
| list[].initiatorCredit | number | 发起人信用分 |
| list[].status | string | 活动状态 |
| total | number | 总条数 |
| hasMore | boolean | 是否有下一页 |

**业务规则：**
- 仅返回 status 为 `pending` 的活动
- 按距离升序排列

---

### 1.3 getActivityDetail — 获取活动详情

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| activityId | string | 是 | 活动 ID |

**响应 data：**

| 字段 | 类型 | 说明 |
|------|------|------|
| activityId | string | 活动 ID |
| title | string | 活动主题 |
| depositTier | number | 鸽子费（分） |
| maxParticipants | number | 最大人数 |
| currentParticipants | number | 当前已通过人数 |
| location | object | 完整地点信息 |
| meetTime | string | 见面时间 |
| identityHint | string | 接头特征 |
| initiatorCredit | number | 发起人信用分 |
| status | string | 活动状态 |
| wechatId | string / null | 发起人微信号（仅活动开始前 2 小时内、已通过的参与者可见） |
| myParticipation | object / null | 当前用户的参与记录（如有） |

**业务规则：**
- wechatId 解密返回条件：调用者是已 approved 的参与者 且 距 meetTime ≤ 2 小时
- 其他情况 wechatId 返回 null

---

### 1.4 approveParticipant — 同意参与者

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| activityId | string | 是 | 活动 ID |
| participationId | string | 是 | 参与记录 ID |

**响应 data：**

| 字段 | 类型 | 说明 |
|------|------|------|
| success | boolean | 操作结果 |

**业务规则：**
- 仅活动发起人可调用，否则返回 1002
- participation 状态必须为 `paid`，否则返回 1004
- 已通过人数不能超过 maxParticipants
- 同意后活动状态自动变为 `confirmed`

---

### 1.5 rejectParticipant — 拒绝参与者

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| activityId | string | 是 | 活动 ID |
| participationId | string | 是 | 参与记录 ID |

**响应 data：**

| 字段 | 类型 | 说明 |
|------|------|------|
| success | boolean | 操作结果 |

**业务规则：**
- 仅活动发起人可调用
- 拒绝后自动触发全额退款

---

## 2. 支付与资金

### 2.1 createDeposit — 创建押金支付

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| activityId | string | 是 | 活动 ID |

**响应 data：**

| 字段 | 类型 | 说明 |
|------|------|------|
| participationId | string | 参与记录 ID |
| paymentParams | object | 微信支付调起参数 `{ timeStamp, nonceStr, package, signType, paySign }` |

**业务规则：**
- 检查用户信用分，< 60 返回 2002
- 不能重复报名同一活动
- 不能报名自己发起的活动
- 活动状态必须为 `pending`
- 金额从活动的 depositTier 获取

---

### 2.2 payCallback — 支付回调（微信服务端调用）

**说明：** 微信支付异步通知，非前端调用。

**处理逻辑：**
1. 验证签名
2. 根据 out_trade_no 找到 participation 记录
3. 更新 participation 状态为 `paid`
4. 写入 transactions 流水（type: `deposit`）

---

## 3. 核销

### 3.1 generateQrToken — 生成核销码

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| activityId | string | 是 | 活动 ID |

**响应 data：**

| 字段 | 类型 | 说明 |
|------|------|------|
| qrToken | string | JWT token，用于生成二维码 |
| expireAt | number | 过期时间戳（秒） |

**业务规则：**
- 仅 `approved` 状态的参与者可调用
- 生成新 token 时自动使旧 token 失效
- token 有效期 60 秒

---

### 3.2 verifyQrToken — 扫码核销

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| qrToken | string | 是 | 扫码获取的 token |

**响应 data：**

| 字段 | 类型 | 说明 |
|------|------|------|
| success | boolean | 核销结果 |
| participantInfo | object | `{ participationId, activityId }` |
| refundStatus | string | 退款发起状态 |

**业务规则：**
- 仅活动发起人可调用，否则返回 1002
- 校验 token 签名、有效期、活动匹配
- 核销成功后：
  1. 更新 participation 状态为 `verified`
  2. 触发全额退款
  3. 双方信用分 +2
  4. 如所有参与者均已核销，活动状态变为 `verified`

---

### 3.3 reportArrival — 报告到达

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| activityId | string | 是 | 活动 ID |
| latitude | number | 是 | 当前纬度 |
| longitude | number | 是 | 当前经度 |

**响应 data：**

| 字段 | 类型 | 说明 |
|------|------|------|
| success | boolean | 记录结果 |
| distance | number | 与活动地点的距离（米） |

**业务规则：**
- 发起人和已 approved 的参与者均可调用
- 记录 arrivedAt 和 arrivedLocation
- 仅记录，不做判定（判定由自动仲裁执行）

---

## 4. 信用分

### 4.1 getCreditInfo — 获取信用信息

**请求参数：** 无（通过 openId 自动识别）

**响应 data：**

| 字段 | 类型 | 说明 |
|------|------|------|
| score | number | 当前信用分 |
| totalVerified | number | 累计核销成功次数 |
| totalBreached | number | 累计违约次数 |
| status | string | `active` / `restricted` / `banned` |
| level | string | 信用等级描述 |

---

## 5. 举报

### 5.1 submitReport — 提交举报

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| activityId | string | 是 | 活动 ID |
| type | string | 是 | 举报类型：`initiator_absent` / `mismatch` / `illegal` |
| description | string | 否 | 补充说明，最多 200 字 |
| images | array | 是 | 图片云存储 fileID 列表，1-3 张 |
| latitude | number | 是 | 举报时的纬度 |
| longitude | number | 是 | 举报时的经度 |

**响应 data：**

| 字段 | 类型 | 说明 |
|------|------|------|
| reportId | string | 举报记录 ID |
| status | string | `submitted` |

**业务规则：**
- 仅已 approved 的参与者可举报
- 图片需先上传至云存储，传入 fileID
- 举报后冻结该活动的资金结算，等待人工审核

---

## 6. 用户历史

### 6.1 getMyActivities — 获取我的活动

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| role | string | 否 | `initiator` / `participant`，不传则返回全部 |
| page | number | 否 | 页码，默认 1 |
| pageSize | number | 否 | 每页条数，默认 20 |

**响应 data：**

| 字段 | 类型 | 说明 |
|------|------|------|
| list | array | 活动列表（含参与状态） |
| total | number | 总条数 |
| hasMore | boolean | 是否有下一页 |


---

## 7. 活动日历

### 7.1 getCalendarActivities — 获取日历活动数据

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| year | number | 是 | 年份，如 2026 |
| month | number | 是 | 月份，1-12 |

**响应 data：**

| 字段 | 类型 | 说明 |
|------|------|------|
| days | object | 以日期为 key 的活动映射，如 `{ "2026-03-26": [...] }` |
| days[date][] | object | 活动摘要 `{ activityId, title, meetTime, location, status, role, depositTier }` |
| days[date][].status | string | 日历状态：`verified`(绿) / `upcoming`(黄) / `breached`(红) / `cancelled`(灰) |
| days[date][].role | string | 用户角色：`initiator` / `participant` |
| summary | object | 月度统计 |
| summary.totalActivities | number | 本月活动总数 |
| summary.verifiedCount | number | 成功核销次数 |
| summary.breachedCount | number | 违约次数 |
| summary.complianceRate | number | 守约率（百分比，0-100） |
| summary.totalCompensation | number | 累计获得补偿（分） |
| summary.plannedExpense | number | 本月已计划支出（分） |

**业务规则：**
- 合并查询发起人和参与者的活动
- status 映射：verified/refunded → `verified`(绿)，confirmed/approved/paid → `upcoming`(黄)，breached/settled → `breached`(红)，expired/cancelled → `cancelled`(灰)

### 7.2 checkConflict — 检查活动时间冲突

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| meetTime | string | 是 | 待加入活动的见面时间，ISO 8601 |
| duration | number | 否 | 预估活动时长（分钟），默认 120 |
| activityLocation | object | 是 | `{ latitude, longitude }` |

**响应 data：**

| 字段 | 类型 | 说明 |
|------|------|------|
| hasConflict | boolean | 是否存在时间冲突 |
| hasRouteRisk | boolean | 是否存在路程风险 |
| conflicts | array | 冲突活动列表 `[{ activityId, title, meetTime }]` |
| routeWarning | string / null | 路程预警文案，如"与XX活动相隔15km，仅间隔30分钟" |

---

## 8. 信用海报

### 8.1 getPosterData — 获取海报数据

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| year | number | 是 | 年份 |
| month | number | 是 | 月份 |

**响应 data：**

| 字段 | 类型 | 说明 |
|------|------|------|
| calendarDots | object | 日期到颜色的映射 `{ "1": "green", "5": "green", "12": "red" }` |
| verifiedCount | number | 本月守约次数 |
| breachedCount | number | 本月违约次数 |
| creditScore | number | 当前契约分 |
| beatPercent | number | 击败百分比（0-100） |
| slogan | string | 海报文案 |
