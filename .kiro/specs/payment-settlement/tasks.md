# 实现计划: 支付结算系统

## 概述

基于设计文档，按增量方式实现支付结算系统：先实现 `_shared/pay.js` 核心支付模块，再逐个实现 4 个云函数，最后集成前端支付流程。每个步骤都在前一步基础上构建，确保无孤立代码。

## Tasks

- [x] 1. 实现 _shared/pay.js 支付模块
  - [x] 1.1 实现 pay.js 核心工具函数和 createOrder 方法
    - 实现 `generateNonceStr()`、`generateSign()`、`verifyCallbackSign()` 工具函数
    - 实现 `createOrder({ openId, outTradeNo, totalFee, description, notifyUrl })`，调用微信支付统一下单 API，返回 `{ timeStamp, nonceStr, package, signType, paySign }`
    - 从 `config.js` 读取 WX_MCH_ID、WX_API_KEY 配置
    - 失败时抛出包含错误码 3001 的异常
    - _Requirements: 1.1, 1.2, 1.5, 1.8_

  - [x] 1.2 实现 pay.js 的 refund 和 splitBill 方法
    - 实现 `refund({ outTradeNo, outRefundNo, totalFee, refundFee })`，使用商户证书认证调用退款 API
    - 实现 `splitBill({ transactionId, outOrderNo, receivers })`，调用分账 API
    - 从云函数私有目录读取商户证书文件
    - refund 失败抛出错误码 3002，splitBill 失败抛出错误码 3003
    - _Requirements: 1.3, 1.4, 1.6, 1.7, 1.9_

  - [x] 1.3 实现 calculateSplitAmounts 和 generateOutTradeNo 工具函数
    - 实现 `calculateSplitAmounts(depositAmount)`：平台 30% 向下取整，发起人获得剩余金额
    - 实现 `generateOutTradeNo()` 和 `generateOutRefundNo()`：生成唯一商户订单号
    - 导出这些工具函数供云函数使用
    - _Requirements: 5.7, 2.11, 4.6_

  - [x]* 1.4 编写 pay.js 工具函数的属性测试
    - **Property 1: 分账金额不变量** — 对任意押金金额，platformAmount + initiatorAmount === depositAmount，且两者均 > 0
    - **Property 7: 商户订单号唯一性** — 对任意两次生成调用，结果互不相同
    - **Property 8: payCallback 签名验证** — 正确密钥签名验证通过，错误密钥或篡改数据验证失败
    - **Validates: Requirements 5.7, 2.11, 4.6, 3.1**

- [x] 2. 实现 createDeposit 云函数
  - [x] 2.1 实现 createDeposit 参数校验和业务校验逻辑
    - 创建 `cloudfunctions/createDeposit/index.js`
    - 通过 `cloud.getWXContext().OPENID` 获取调用者身份
    - 校验 activityId 非空
    - 查询信用分，< 60 返回 2002
    - 查询活动记录，不存在返回 1003，状态非 pending 返回 1004
    - 校验非发起人（否则 1004）、未重复参与（否则 1004）
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

  - [x] 2.2 实现 createDeposit 支付下单和记录创建逻辑
    - 从活动记录获取 depositTier 作为支付金额
    - 生成 outTradeNo
    - 创建 participation 记录（status: pending）
    - 调用 pay.createOrder() 获取支付参数
    - 创建 transaction 记录（type: deposit, status: pending）
    - 返回 { participationId, paymentParams }
    - createOrder 失败时回滚删除 participation 和 transaction 记录，返回 3001
    - _Requirements: 2.10, 2.11, 2.12, 2.13, 2.14, 2.15, 2.16_

  - [x]* 2.3 编写 createDeposit 的属性测试和单元测试
    - **Property 2: createDeposit 信用分校验** — 信用分 < 60 返回 2002，>= 60 继续
    - **Property 3: createDeposit 活动状态校验** — 非 pending 返回 1004
    - **Property 4: createDeposit 自参与防护** — openId === initiatorId 返回 1004
    - **Property 5: createDeposit 重复参与防护** — 已有非 rejected 记录返回 1004
    - **Property 6: createDeposit 失败回滚** — createOrder 失败后无孤立记录
    - 单元测试：活动不存在返回 1003、参数缺失返回 1001
    - **Validates: Requirements 2.5, 2.7, 2.8, 2.9, 2.16**

- [x] 3. 实现 payCallback 云函数
  - [x] 3.1 实现 payCallback 签名验证和状态更新逻辑
    - 创建 `cloudfunctions/payCallback/index.js`
    - 验证微信支付回调签名，失败返回 FAIL 应答
    - 解析支付结果数据
    - 支付成功：根据 out_trade_no 查找 transaction → 找到 participation → 幂等检查 → 更新 participation.status 为 paid → 更新 transaction.status 为 success
    - 支付失败：更新 transaction.status 为 failed
    - 参与记录不存在时记录日志并返回 SUCCESS
    - 返回成功应答
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

  - [x]* 3.2 编写 payCallback 的属性测试和单元测试
    - **Property 9: payCallback 状态同步更新** — 支付成功后 participation.status 为 paid，transaction.status 为 success
    - 单元测试：签名验证失败返回 FAIL、参与记录不存在返回 SUCCESS、支付失败更新 transaction 为 failed
    - **Validates: Requirements 3.6, 3.7**

- [x] 4. Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 5. 实现 refundDeposit 云函数
  - [x] 5.1 实现 refundDeposit 退款逻辑
    - 创建 `cloudfunctions/refundDeposit/index.js`
    - 校验 participationId 非空，缺失返回 1001
    - 查询 participation 记录，不存在返回 1003
    - 查找关联的 deposit 类型且 success 状态的 transaction，不存在返回 1004
    - 生成 outRefundNo
    - 调用 pay.refund() 发起全额退款（refundFee === totalFee）
    - 更新 participation.status 为 refunded
    - 创建 refund 类型的 transaction 记录
    - 失败返回 3002
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11_

  - [x]* 5.2 编写 refundDeposit 的属性测试和单元测试
    - **Property 10: refundDeposit 全额退款** — refundFee === totalFee，操作后 status 为 refunded，存在 refund 类型 transaction
    - 单元测试：参与记录不存在返回 1003、无成功支付流水返回 1004、退款 API 失败返回 3002
    - **Validates: Requirements 4.7, 4.8, 4.9**

- [x] 6. 实现 splitDeposit 云函数
  - [x] 6.1 实现 splitDeposit 分账逻辑
    - 创建 `cloudfunctions/splitDeposit/index.js`
    - 校验 participationId 和 activityId 非空，缺失返回 1001
    - 查询 participation 和 activity 记录，不存在返回 1003
    - 查找关联的 deposit 类型且 success 状态的 transaction，不存在返回 1004
    - 调用 calculateSplitAmounts() 计算分账金额
    - 构建 receivers 数组（平台 30%、发起人 70%）
    - 调用 pay.splitBill() 发起分账
    - 创建两条 transaction 记录（split_platform + split_initiator）
    - 更新 participation.status 为 settled
    - 失败返回 3003
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 5.12_

  - [x]* 6.2 编写 splitDeposit 的属性测试和单元测试
    - **Property 11: splitDeposit 完整操作** — 操作后存在两条 transaction（split_platform + split_initiator），amount 之和等于押金，status 为 settled
    - 单元测试：参与记录不存在返回 1003、活动不存在返回 1003、无支付流水返回 1004、分账 API 失败返回 3003
    - **Validates: Requirements 5.8, 5.9, 5.10**

- [x] 7. Checkpoint - 确保所有后端测试通过
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 8. 前端支付流程集成
  - [x] 8.1 实现活动详情页支付按钮和支付流程
    - 在 `pages/activity/detail/detail.js` 中添加 `formatAmount(amountInCents)` 金额格式化函数
    - 添加 `shouldShowPayButton(activity, openId, myParticipation)` 按钮显示判断逻辑
    - 实现 `handleDeposit()` 方法：调用 createDeposit → wx.requestPayment → 成功刷新/失败提示
    - 在 `detail.wxml` 中添加报名按钮，绑定条件显示和点击事件
    - 支付进行中禁用按钮并显示加载状态
    - 根据错误码（2002/1004）显示对应中文提示
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [x]* 8.2 编写前端工具函数的属性测试
    - **Property 12: 报名按钮显示条件** — 仅当 status=pending、非发起人、无参与记录时显示
    - **Property 13: 金额格式化** — 分转元后再转回分应还原原值
    - **Validates: Requirements 6.1**

- [x] 9. 最终 Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请向用户确认。

## Notes

- 标记 `*` 的任务为可选测试任务，可跳过以加速 MVP 开发
- 每个任务引用了具体的需求编号以确保可追溯性
- 属性测试验证通用正确性，单元测试验证具体边界和错误条件
- 所有金额以"分"为单位处理，前端显示时转换为"元"
