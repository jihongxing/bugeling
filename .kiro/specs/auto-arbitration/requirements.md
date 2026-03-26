# 需求文档 - 自动仲裁系统

## 简介

本需求定义"不鸽令"微信小程序的自动仲裁系统，包含 2 个定时触发云函数（autoArbitrate、executeSplit）。

自动仲裁是"不鸽令"契约引擎的最终裁决环节：当活动超时 60 分钟仍未核销时，系统自动根据双方到达记录（LBS 坐标）进行裁决，执行违约分账或退款操作。为保障用户权益，违约分账设有 24 小时申诉缓冲期，由 executeSplit 定时函数在缓冲期满后执行实际分账。

### 依赖关系

- Spec 1（project-scaffold）：`_shared/db.js`、`_shared/config.js`
- Spec 2（activity-crud）：活动和参与记录数据模型、`_shared/response.js`
- Spec 4（payment-settlement）：`_shared/pay.js`（refundDeposit 退款、splitDeposit 分账）、transactions 数据模型
- Spec 5（verification-qrcode）：reportArrival 到达记录数据（arrivedAt、arrivedLocation）、Haversine 距离计算
- Spec 6（credit-system）：`_shared/credit.js`（updateCredit 信用分扣减）

## 术语表

- **自动仲裁 (Auto_Arbitrate)**：系统在活动超时后自动执行的裁决流程，根据双方到达记录判定违约方并执行相应操作
- **超时阈值 (Timeout_Threshold)**：活动约定见面时间（meetTime）后 60 分钟，超过此时间未核销即触发自动仲裁
- **距离阈值 (Distance_Threshold)**：1000 米，用于判定用户是否到达活动地点
- **Haversine 公式 (Haversine_Formula)**：根据两点经纬度计算球面距离的数学公式，用于计算用户到达位置与活动地点的距离
- **到达记录 (Arrival_Record)**：用户点击"我已到达"时记录的时间戳和 LBS 坐标，发起人的到达记录存储在活动记录（activity.arrivedAt、activity.arrivedLocation）中，参与者的到达记录存储在参与记录（participation.arrivedAt、participation.arrivedLocation）中
- **参与人缺席 (Participant_Absent)**：参与者无到达记录，或到达位置与活动地点距离超过 1000 米
- **发起人缺席 (Initiator_Absent)**：发起人无到达记录，或到达位置与活动地点距离超过 1000 米
- **见后变卦 (Present_But_Unverified)**：双方均在场（距离 ≤ 1000 米）但未完成核销，根据契约铁律视为参与方放弃
- **互鸽 (Mutual_Noshow)**：双方均未到场，押金原路退回，双方各扣 5 分信用分
- **申诉缓冲期 (Appeal_Buffer)**：违约判定后 24 小时内的申诉窗口期，期间不执行实际分账
- **breachedAt**：参与记录上记录违约判定时间的时间戳字段，用于计算申诉缓冲期
- **活动 (Activity)**：发起人创建的线下约见契约，存储在 `activities` 集合中
- **参与记录 (Participation)**：记录参与者与活动的关联关系及状态，存储在 `participations` 集合中
- **信用分 (Credit_Score)**：用户的履约信用评分，通过 `_shared/credit.js` 的 `updateCredit` 方法更新
- **分账 (Profit_Sharing)**：通过 Spec 4 的 splitDeposit 云函数将违约押金按 30%（平台）/ 70%（发起人）比例分配
- **退款 (Refund)**：通过 Spec 4 的 refundDeposit 云函数将押金全额原路退回参与者

## 需求

### 需求 1：超时活动扫描与筛选（autoArbitrate 云函数）

**用户故事：** 作为系统，我需要定时扫描所有超时未核销的活动，以便及时启动自动仲裁流程。

#### 验收标准

1. THE autoArbitrate 云函数 SHALL 通过定时触发器每分钟执行一次
2. WHEN autoArbitrate 执行时，THE autoArbitrate SHALL 查询 `activities` 集合中 `status` 为 `confirmed` 且 `meetTime` + 60 分钟 < 当前时间的所有活动记录
3. WHEN 查询到符合条件的活动后，THE autoArbitrate SHALL 对每个活动查询 `participations` 集合中 `activityId` 匹配且 `status` 为 `approved` 的所有参与记录
4. IF 某活动没有状态为 `approved` 的参与记录，THEN THE autoArbitrate SHALL 直接将该活动的 `status` 更新为 `expired`
5. WHEN 所有参与记录处理完成后，THE autoArbitrate SHALL 将该活动的 `status` 更新为 `expired`

### 需求 2：距离计算与到场判定

**用户故事：** 作为系统，我需要根据到达记录判定双方是否到场，以便为仲裁决策提供依据。

#### 验收标准

1. THE autoArbitrate SHALL 使用 Haversine_Formula 计算到达位置坐标与活动地点坐标（activity.location.latitude、activity.location.longitude）之间的距离
2. WHEN 参与者的参与记录中存在 `arrivedAt` 和 `arrivedLocation` 字段时，THE autoArbitrate SHALL 计算参与者到达位置与活动地点的距离
3. IF 参与者无 `arrivedAt` 记录或到达位置与活动地点距离 > 1000 米，THEN THE autoArbitrate SHALL 判定该参与者为缺席
4. WHEN 活动记录中存在 `arrivedAt` 和 `arrivedLocation` 字段时，THE autoArbitrate SHALL 计算发起人到达位置与活动地点的距离
5. IF 活动无 `arrivedAt` 记录或发起人到达位置与活动地点距离 > 1000 米，THEN THE autoArbitrate SHALL 判定发起人为缺席
6. THE autoArbitrate SHALL 对每个活动仅执行一次发起人到场判定，该判定结果适用于该活动下的所有参与记录

### 需求 3：参与人缺席裁决（场景 A）

**用户故事：** 作为系统，我需要在参与人未到场时执行违约处理，以便补偿发起人的时间损失。

#### 验收标准

1. WHEN 参与者被判定为缺席且发起人被判定为到场时，THE autoArbitrate SHALL 将该参与记录的 `status` 更新为 `breached`
2. WHEN 参与记录状态更新为 `breached` 时，THE autoArbitrate SHALL 在该参与记录上设置 `breachedAt` 为当前服务器时间
3. WHEN 参与人缺席裁决完成后，THE autoArbitrate SHALL 调用 `updateCredit(participantId, -20, 'breached')` 扣减参与者 20 分信用分

### 需求 4：发起人缺席裁决（场景 B）

**用户故事：** 作为系统，我需要在发起人未到场时保护参与者权益，以便全额退还参与者押金。

#### 验收标准

1. WHEN 发起人被判定为缺席且参与者被判定为到场时，THE autoArbitrate SHALL 将该参与记录的 `status` 更新为 `refunded`
2. WHEN 发起人缺席裁决完成后，THE autoArbitrate SHALL 调用 refundDeposit 云函数对该参与记录执行全额退款
3. WHEN 发起人缺席裁决完成后，THE autoArbitrate SHALL 调用 `updateCredit(initiatorId, -20, 'breached')` 扣减发起人 20 分信用分

### 需求 5：双方到场未核销裁决（场景 C - 见后变卦）

**用户故事：** 作为系统，我需要在双方均到场但未核销时按契约铁律处理，以便补偿发起人。

#### 验收标准

1. WHEN 参与者和发起人均被判定为到场但未完成核销时，THE autoArbitrate SHALL 将该参与记录的 `status` 更新为 `breached`
2. WHEN 双方到场未核销裁决完成后，THE autoArbitrate SHALL 在该参与记录上设置 `breachedAt` 为当前服务器时间
3. THE autoArbitrate SHALL 在双方到场未核销场景下不执行任何信用分扣减操作

### 需求 6：双方缺席裁决（场景 D - 互鸽）

**用户故事：** 作为系统，我需要在双方均未到场时执行互鸽处理，以便退还押金并扣减双方信用分。

#### 验收标准

1. WHEN 参与者和发起人均被判定为缺席时，THE autoArbitrate SHALL 将该参与记录的 `status` 更新为 `refunded`
2. WHEN 双方缺席裁决完成后，THE autoArbitrate SHALL 调用 refundDeposit 云函数对该参与记录执行全额退款
3. WHEN 双方缺席裁决完成后，THE autoArbitrate SHALL 调用 `updateCredit(participantId, -5, 'mutual_noshow')` 扣减参与者 5 分信用分
4. WHEN 双方缺席裁决完成后，THE autoArbitrate SHALL 调用 `updateCredit(initiatorId, -5, 'mutual_noshow')` 扣减发起人 5 分信用分

### 需求 7：申诉缓冲期分账执行（executeSplit 云函数）

**用户故事：** 作为系统，我需要在 24 小时申诉缓冲期满后执行实际分账，以便在保障用户申诉权利的同时完成违约结算。

#### 验收标准

1. THE executeSplit 云函数 SHALL 通过定时触发器每小时执行一次
2. WHEN executeSplit 执行时，THE executeSplit SHALL 查询 `participations` 集合中 `status` 为 `breached` 且 `breachedAt` + 24 小时 < 当前时间的所有参与记录
3. WHEN 查询到符合条件的参与记录后，THE executeSplit SHALL 检查该参与记录关联的活动是否存在状态为 `submitted` 的举报记录（reports 集合）
4. IF 存在待处理的举报记录，THEN THE executeSplit SHALL 跳过该参与记录，不执行分账
5. IF 不存在待处理的举报记录，THEN THE executeSplit SHALL 调用 splitDeposit 云函数执行分账操作
6. WHEN splitDeposit 调用成功后，THE executeSplit SHALL 将该参与记录的 `status` 更新为 `settled`

### 需求 8：定时触发器配置

**用户故事：** 作为开发者，我需要配置云函数的定时触发器，以便自动仲裁和分账执行按预定频率运行。

#### 验收标准

1. THE autoArbitrate 云函数目录 SHALL 包含 `config.json` 文件，配置定时触发器 cron 表达式为 `0 */1 * * * * *`（每分钟执行）
2. THE executeSplit 云函数目录 SHALL 包含 `config.json` 文件，配置定时触发器 cron 表达式为 `0 0 */1 * * * *`（每小时执行）

### 需求 9：仲裁错误处理与容错

**用户故事：** 作为系统，我需要在仲裁过程中妥善处理异常，以便单条记录的失败不影响其他记录的处理。

#### 验收标准

1. IF autoArbitrate 处理某条参与记录时发生异常，THEN THE autoArbitrate SHALL 记录错误日志并继续处理下一条参与记录
2. IF autoArbitrate 处理某个活动时发生异常，THEN THE autoArbitrate SHALL 记录错误日志并继续处理下一个活动
3. IF refundDeposit 调用失败，THEN THE autoArbitrate SHALL 记录错误日志，参与记录状态仍更新为对应的裁决结果（refunded）
4. IF updateCredit 调用失败，THEN THE autoArbitrate SHALL 记录错误日志，不影响参与记录状态更新和资金操作
5. IF executeSplit 处理某条参与记录时 splitDeposit 调用失败，THEN THE executeSplit SHALL 记录错误日志并继续处理下一条记录，该参与记录保持 `breached` 状态等待下次重试
