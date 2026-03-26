# 需求文档 - 支付结算系统

## 简介

本需求定义"不鸽令"微信小程序的支付与结算后端功能，包含 4 个核心云函数（createDeposit、payCallback、refundDeposit、splitDeposit）、`_shared/pay.js` 支付模块的完整实现，以及活动详情页的前端支付流程集成。

本 Spec 覆盖完整的支付生命周期：押金下单 → 支付回调确认 → 履约退款 → 违约分账。

### 依赖关系

- Spec 1（project-scaffold）：项目目录结构、`_shared/db.js`、`_shared/config.js`、`_shared/pay.js` 骨架代码
- Spec 2（activity-crud）：活动和参与记录数据模型、`_shared/validator.js`、`_shared/response.js`
- Spec 3（activity-pages）：活动详情页（需集成支付按钮）

## 术语表

- **押金 (Deposit)**：参与者预缴的鸽子费，以"分"为单位存储，枚举值为 990/1990/2990/3990/4990
- **统一下单 (Unified_Order)**：微信支付统一下单 API，用于创建支付订单并返回前端调起支付所需的参数
- **支付回调 (Pay_Callback)**：微信支付服务器在用户支付成功后，向商户服务端发送的异步通知
- **退款 (Refund)**：通过微信支付退款 API 将已支付金额原路退回用户
- **分账 (Profit_Sharing)**：通过微信支付分账 API 将违约押金按比例分配给平台（30%）和发起人（70%）
- **商户号 (WX_MCH_ID)**：微信支付商户平台分配的商户标识，存储在云函数环境变量中
- **API 密钥 (WX_API_KEY)**：微信支付 API 签名密钥，存储在云函数环境变量中
- **商户证书 (Merchant_Cert)**：微信支付商户 API 证书（apiclient_cert.pem 和 apiclient_key.pem），用于退款和分账接口的身份认证，存储在云函数私有目录中
- **交易流水 (Transaction)**：记录每笔资金操作的流水记录，存储在 `transactions` 集合中，类型包括 `deposit`/`refund`/`split_platform`/`split_initiator`
- **商户订单号 (OutTradeNo)**：商户侧生成的唯一订单号，用于标识一笔支付交易
- **支付参数 (PaymentParams)**：前端调起微信支付所需的参数集合，包含 `timeStamp`、`nonceStr`、`package`、`signType`、`paySign`
- **活动 (Activity)**：发起人创建的线下约见契约，存储在 `activities` 集合中
- **参与记录 (Participation)**：记录参与者与活动的关联关系及支付状态，存储在 `participations` 集合中
- **信用分 (Credit_Score)**：用户的履约信用评分，初始 100 分，存储在 `credits` 集合中
- **云函数上下文 (WX_Context)**：通过 `cloud.getWXContext()` 获取的调用者身份信息，包含 `OPENID` 字段

## 需求

### 需求 1：支付模块 _shared/pay.js 完整实现

**用户故事：** 作为开发者，我希望有一个封装完善的支付模块，以便各云函数可以统一调用微信支付的下单、退款和分账接口。

#### 验收标准

1. THE pay.js 模块 SHALL 导出 `createOrder`、`refund`、`splitBill` 三个异步函数
2. WHEN 调用 `createOrder({ openId, outTradeNo, totalFee, description, notifyUrl })` 时，THE pay.js SHALL 使用 WX_MCH_ID 和 WX_API_KEY 构造微信支付统一下单请求，并返回 `{ timeStamp, nonceStr, package, signType, paySign }`
3. WHEN 调用 `refund({ outTradeNo, outRefundNo, totalFee, refundFee })` 时，THE pay.js SHALL 使用商户证书认证并调用微信支付退款 API 发起退款
4. WHEN 调用 `splitBill({ transactionId, outOrderNo, receivers })` 时，THE pay.js SHALL 调用微信支付分账 API，其中 receivers 数组中每个元素包含 `{ type, account, amount, description }`
5. IF 微信支付统一下单 API 返回失败，THEN THE pay.js SHALL 抛出包含错误码 3001 和微信返回错误信息的异常
6. IF 微信支付退款 API 返回失败，THEN THE pay.js SHALL 抛出包含错误码 3002 和微信返回错误信息的异常
7. IF 微信支付分账 API 返回失败，THEN THE pay.js SHALL 抛出包含错误码 3003 和微信返回错误信息的异常
8. THE pay.js SHALL 从 `config.js` 读取 WX_MCH_ID、WX_API_KEY 等配置项
9. THE pay.js SHALL 从云函数私有目录读取商户证书文件（apiclient_cert.pem、apiclient_key.pem）用于退款和分账请求

### 需求 2：创建押金支付（createDeposit 云函数）

**用户故事：** 作为参与者，我希望支付鸽子费报名活动，以便加入线下约见契约。

#### 验收标准

1. WHEN 调用 createDeposit 云函数时，THE createDeposit SHALL 通过 `cloud.getWXContext().OPENID` 获取调用者身份
2. WHEN 接收到请求参数时，THE createDeposit SHALL 校验 `activityId` 为非空字符串
3. IF `activityId` 缺失或为空，THEN THE createDeposit SHALL 返回错误码 1001
4. WHEN 参数校验通过后，THE createDeposit SHALL 查询调用者的信用分记录
5. IF 调用者信用分低于 60，THEN THE createDeposit SHALL 返回错误码 2002 并说明信用分不足
6. IF 指定的活动记录不存在，THEN THE createDeposit SHALL 返回错误码 1003
7. IF 活动的 `status` 不为 `pending`，THEN THE createDeposit SHALL 返回错误码 1004 并说明活动状态不允许报名
8. IF 调用者的 openId 与活动的 `initiatorId` 相同，THEN THE createDeposit SHALL 返回错误码 1004 并说明不能报名自己发起的活动
9. IF 调用者在该活动的 `participations` 集合中已存在状态非 `rejected` 的记录，THEN THE createDeposit SHALL 返回错误码 1004 并说明不能重复报名
10. WHEN 所有校验通过后，THE createDeposit SHALL 从活动记录中获取 `depositTier` 作为支付金额
11. WHEN 所有校验通过后，THE createDeposit SHALL 生成唯一的商户订单号 `outTradeNo`
12. WHEN 所有校验通过后，THE createDeposit SHALL 在 `participations` 集合中创建一条记录，包含 `activityId`、`participantId`（调用者 openId）、`depositAmount`（活动的 depositTier）、`status` 设为 `pending`、`createdAt` 设为当前服务器时间
13. WHEN 参与记录创建成功后，THE createDeposit SHALL 调用 `pay.createOrder()` 获取支付参数
14. WHEN 参与记录创建成功后，THE createDeposit SHALL 在 `transactions` 集合中创建一条流水记录，包含 `activityId`、`participationId`、`type` 设为 `deposit`、`amount`（depositTier）、`outTradeNo`、`status` 设为 `pending`、`createdAt` 设为当前服务器时间
15. WHEN 支付参数获取成功后，THE createDeposit SHALL 返回 `{ code: 0, data: { participationId, paymentParams } }`
16. IF `pay.createOrder()` 调用失败，THEN THE createDeposit SHALL 删除已创建的参与记录和流水记录，并返回错误码 3001

### 需求 3：支付回调处理（payCallback 云函数）

**用户故事：** 作为系统，我需要处理微信支付的异步通知，以便确认用户的支付状态并更新参与记录。

#### 验收标准

1. WHEN 接收到微信支付回调通知时，THE payCallback SHALL 验证请求的签名合法性
2. IF 签名验证失败，THEN THE payCallback SHALL 返回失败应答给微信服务器
3. WHEN 签名验证通过后，THE payCallback SHALL 解析通知中的支付结果数据
4. WHEN 支付结果为成功时，THE payCallback SHALL 根据 `out_trade_no` 查找对应的参与记录
5. IF 对应的参与记录不存在，THEN THE payCallback SHALL 记录错误日志并返回成功应答（避免微信重复通知）
6. WHEN 找到参与记录后，THE payCallback SHALL 将参与记录的 `status` 更新为 `paid`，并将 `paymentId` 设为微信支付订单号
7. WHEN 参与记录更新成功后，THE payCallback SHALL 将对应的 `transactions` 流水记录的 `status` 更新为 `success`，并记录微信支付订单号 `wxPayOrderId`
8. WHEN 所有更新完成后，THE payCallback SHALL 返回成功应答给微信服务器
9. IF 支付结果为失败时，THE payCallback SHALL 将对应的 `transactions` 流水记录的 `status` 更新为 `failed`，并返回成功应答

### 需求 4：退款处理（refundDeposit 云函数）

**用户故事：** 作为系统，我需要在核销成功或发起人拒绝后执行全额退款，以便将押金原路退回参与者。

#### 验收标准

1. WHEN 调用 refundDeposit 云函数时，THE refundDeposit SHALL 接收 `participationId`(string, 必填) 参数
2. IF `participationId` 缺失或为空，THEN THE refundDeposit SHALL 返回错误码 1001
3. IF 指定的参与记录不存在，THEN THE refundDeposit SHALL 返回错误码 1003
4. WHEN 找到参与记录后，THE refundDeposit SHALL 查找该参与记录关联的 `type` 为 `deposit` 且 `status` 为 `success` 的交易流水
5. IF 未找到对应的成功支付流水，THEN THE refundDeposit SHALL 返回错误码 1004 并说明无可退款的支付记录
6. WHEN 找到支付流水后，THE refundDeposit SHALL 生成唯一的退款单号 `outRefundNo`
7. WHEN 退款单号生成后，THE refundDeposit SHALL 调用 `pay.refund()` 发起全额退款，传入原订单号、退款单号、原支付金额和退款金额（全额）
8. WHEN 退款发起成功后，THE refundDeposit SHALL 将参与记录的 `status` 更新为 `refunded`
9. WHEN 退款发起成功后，THE refundDeposit SHALL 在 `transactions` 集合中创建一条流水记录，包含 `type` 设为 `refund`、`amount`（退款金额）、`status` 设为 `success`、关联的 `activityId` 和 `participationId`
10. WHEN 操作成功后，THE refundDeposit SHALL 返回 `{ code: 0, data: { success: true } }`
11. IF `pay.refund()` 调用失败，THEN THE refundDeposit SHALL 返回错误码 3002

### 需求 5：违约分账处理（splitDeposit 云函数）

**用户故事：** 作为系统，我需要在仲裁判定违约后执行分账，以便将押金按比例分配给平台和发起人。

#### 验收标准

1. WHEN 调用 splitDeposit 云函数时，THE splitDeposit SHALL 接收 `participationId`(string, 必填) 和 `activityId`(string, 必填) 参数
2. IF `participationId` 或 `activityId` 缺失，THEN THE splitDeposit SHALL 返回错误码 1001
3. IF 指定的参与记录不存在，THEN THE splitDeposit SHALL 返回错误码 1003
4. IF 指定的活动记录不存在，THEN THE splitDeposit SHALL 返回错误码 1003
5. WHEN 找到参与记录和活动记录后，THE splitDeposit SHALL 查找该参与记录关联的 `type` 为 `deposit` 且 `status` 为 `success` 的交易流水
6. IF 未找到对应的成功支付流水，THEN THE splitDeposit SHALL 返回错误码 1004 并说明无可分账的支付记录
7. WHEN 找到支付流水后，THE splitDeposit SHALL 以押金金额为基数计算分账金额：平台收取 30%（向下取整到分）、发起人收取剩余金额（押金总额减去平台金额）
8. WHEN 分账金额计算完成后，THE splitDeposit SHALL 调用 `pay.splitBill()` 发起分账，receivers 数组包含平台账户（30%）和发起人账户（70%）
9. WHEN 分账发起成功后，THE splitDeposit SHALL 在 `transactions` 集合中创建两条流水记录：一条 `type` 为 `split_platform`（平台分账金额），一条 `type` 为 `split_initiator`（发起人分账金额）
10. WHEN 分账发起成功后，THE splitDeposit SHALL 将参与记录的 `status` 更新为 `settled`
11. WHEN 操作成功后，THE splitDeposit SHALL 返回 `{ code: 0, data: { success: true } }`
12. IF `pay.splitBill()` 调用失败，THEN THE splitDeposit SHALL 返回错误码 3003

### 需求 6：前端支付流程集成

**用户故事：** 作为参与者，我希望在活动详情页点击报名按钮后完成支付，以便快速加入活动。

#### 验收标准

1. WHEN 活动详情页加载且活动状态为 `pending` 且当前用户非发起人且当前用户未参与该活动时，THE 活动详情页 SHALL 显示"支付 ¥XX.X 报名"按钮，其中金额从活动的 `depositTier` 转换为元显示
2. WHEN 用户点击报名按钮时，THE 活动详情页 SHALL 调用 `createDeposit` 云函数并传入 `activityId`
3. WHEN `createDeposit` 返回成功时，THE 活动详情页 SHALL 使用返回的 `paymentParams` 调用 `wx.requestPayment` 调起微信支付
4. WHEN `wx.requestPayment` 支付成功回调触发时，THE 活动详情页 SHALL 显示"报名成功"提示并刷新页面以展示最新的参与状态
5. WHEN `wx.requestPayment` 支付失败或用户取消时，THE 活动详情页 SHALL 显示相应的提示信息（"支付失败，请重试"或"已取消支付"）
6. IF `createDeposit` 返回错误码 2002，THEN THE 活动详情页 SHALL 显示"信用分不足，无法报名"提示
7. IF `createDeposit` 返回错误码 1004，THEN THE 活动详情页 SHALL 显示对应的业务错误提示（如"不能报名自己的活动"、"已报名该活动"等）
8. WHILE 支付流程进行中（从点击按钮到支付完成或取消），THE 活动详情页 SHALL 禁用报名按钮并显示加载状态，防止重复提交
