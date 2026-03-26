# 需求文档 - 核销码验证系统

## 简介

本需求定义"不鸽令"微信小程序的核销码验证（QR Code Verification）完整流程，包含 3 个云函数（generateQrToken、verifyQrToken、reportArrival）和 2 个前端页面（核销码展示页、扫码核销页）。

核销流程是"不鸽令"契约引擎的核心环节：参与者在线下出示动态二维码 → 发起人扫码验证 → 系统自动触发退款和信用分更新。动态 Token 机制（60 秒有效期 + 自动刷新）确保截图无法作弊。

### 依赖关系

- Spec 1（project-scaffold）：项目目录结构、`_shared/config.js`（JWT_SECRET 环境变量）、`utils/api.js`、`utils/location.js`
- Spec 2（activity-crud）：活动和参与记录数据模型、`_shared/db.js`、`_shared/response.js`
- Spec 4（payment-settlement）：`_shared/pay.js`（refundDeposit 退款触发）、参与记录状态模型

## 术语表

- **核销码 (QR_Token)**：基于 JWT 签名的动态 Token 字符串，编码为二维码供发起人扫描验证，有效期 60 秒
- **JWT_SECRET**：用于签发和验证核销码 Token 的密钥，存储在 `_shared/config.js` 环境变量中
- **发起人 (Initiator)**：创建活动的用户，拥有扫码核销权限，通过 `activity.initiatorId` 标识
- **参与者 (Participant)**：报名并支付押金的用户，拥有展示核销码权限，通过 `participation.participantId` 标识
- **参与记录 (Participation)**：记录参与者与活动的关联关系，存储在 `participations` 集合中，包含 `qrToken`、`qrExpireAt` 等核销相关字段
- **活动 (Activity)**：发起人创建的线下约见契约，存储在 `activities` 集合中
- **Haversine 公式 (Haversine_Formula)**：根据两点经纬度计算球面距离的数学公式，用于计算用户与活动地点的距离
- **到达记录 (Arrival_Record)**：用户点击"我已到达"时记录的时间戳和 LBS 坐标，供自动仲裁系统使用
- **信用分 (Credit_Score)**：用户的履约信用评分，核销成功后双方各 +2 分，通过 `_shared/credit.js` 的 `updateCredit` 方法更新
- **云函数上下文 (WX_Context)**：通过 `cloud.getWXContext()` 获取的调用者身份信息，包含 `OPENID` 字段
- **nonce**：一次性随机字符串，包含在 JWT payload 中，确保每次生成的 Token 唯一

## 需求

### 需求 1：生成核销码 Token（generateQrToken 云函数）

**用户故事：** 作为参与者，我希望生成动态核销码，以便在线下向发起人出示进行核销验证。

#### 验收标准

1. WHEN 调用 generateQrToken 云函数时，THE generateQrToken SHALL 通过 `cloud.getWXContext().OPENID` 获取调用者身份
2. WHEN 接收到请求参数时，THE generateQrToken SHALL 校验 `activityId` 为非空字符串
3. IF `activityId` 缺失或为空，THEN THE generateQrToken SHALL 返回错误码 1001
4. WHEN 参数校验通过后，THE generateQrToken SHALL 查询调用者在该活动中的参与记录
5. IF 调用者在该活动中不存在状态为 `approved` 的参与记录，THEN THE generateQrToken SHALL 返回错误码 1004
6. WHEN 找到合法参与记录后，THE generateQrToken SHALL 使用 jsonwebtoken 库生成 JWT Token，payload 包含 `activityId`、`participantId`（调用者 openId）、`nonce`（随机字符串），过期时间设为 60 秒
7. WHEN JWT Token 生成后，THE generateQrToken SHALL 使用 JWT_SECRET（从 `_shared/config.js` 读取）对 Token 进行签名
8. WHEN Token 签名完成后，THE generateQrToken SHALL 将 `qrToken` 和 `qrExpireAt`（当前时间 + 60 秒）更新到参与记录中，覆盖任何已有的 Token 值
9. WHEN 参与记录更新成功后，THE generateQrToken SHALL 返回 `{ code: 0, data: { qrToken, expireAt } }`

### 需求 2：扫码核销验证（verifyQrToken 云函数）

**用户故事：** 作为发起人，我希望扫描参与者的核销码完成验证，以便触发押金退款并记录双方履约。

#### 验收标准

1. WHEN 调用 verifyQrToken 云函数时，THE verifyQrToken SHALL 通过 `cloud.getWXContext().OPENID` 获取调用者身份
2. WHEN 接收到请求参数时，THE verifyQrToken SHALL 校验 `qrToken` 为非空字符串
3. IF `qrToken` 缺失或为空，THEN THE verifyQrToken SHALL 返回错误码 1001
4. WHEN 参数校验通过后，THE verifyQrToken SHALL 使用 JWT_SECRET 验证 Token 签名并解码 payload
5. IF Token 签名验证失败或 Token 已过期，THEN THE verifyQrToken SHALL 返回错误码 4001
6. WHEN Token 解码成功后，THE verifyQrToken SHALL 从 payload 中提取 `activityId` 和 `participantId`
7. WHEN 提取活动信息后，THE verifyQrToken SHALL 查询活动记录并校验调用者的 openId 与 `activity.initiatorId` 一致
8. IF 调用者不是活动发起人，THEN THE verifyQrToken SHALL 返回错误码 1002
9. WHEN 发起人身份确认后，THE verifyQrToken SHALL 查询参与记录并校验状态为 `approved`
10. IF 参与记录不存在或状态不为 `approved`，THEN THE verifyQrToken SHALL 返回错误码 1004
11. WHEN 参与记录校验通过后，THE verifyQrToken SHALL 校验 Token 与参与记录中存储的 `qrToken` 字段一致
12. IF Token 与存储的 `qrToken` 不匹配，THEN THE verifyQrToken SHALL 返回错误码 4001
13. WHEN 所有校验通过后，THE verifyQrToken SHALL 将参与记录的 `status` 更新为 `verified`，并设置 `verifiedAt` 为当前服务器时间
14. WHEN 参与记录更新成功后，THE verifyQrToken SHALL 调用 refundDeposit 触发全额退款
15. WHEN 参与记录更新成功后，THE verifyQrToken SHALL 调用 `_shared/credit.js` 的 `updateCredit` 方法，为参与者和发起人各增加 2 分信用分
16. WHEN 退款和信用分更新完成后，THE verifyQrToken SHALL 查询该活动的所有参与记录
17. IF 该活动的所有参与记录状态均为 `verified`，THEN THE verifyQrToken SHALL 将活动状态更新为 `verified`
18. WHEN 所有操作完成后，THE verifyQrToken SHALL 返回 `{ code: 0, data: { success: true, participantInfo: { participationId, activityId }, refundStatus } }`

### 需求 3：报告到达（reportArrival 云函数）

**用户故事：** 作为用户（发起人或参与者），我希望记录到达现场的时间和位置，以便自动仲裁系统在未核销时有据可依。

#### 验收标准

1. WHEN 调用 reportArrival 云函数时，THE reportArrival SHALL 通过 `cloud.getWXContext().OPENID` 获取调用者身份
2. WHEN 接收到请求参数时，THE reportArrival SHALL 校验 `activityId` 为非空字符串、`latitude` 和 `longitude` 为有效数值
3. IF 任一必填参数缺失或格式无效，THEN THE reportArrival SHALL 返回错误码 1001
4. WHEN 参数校验通过后，THE reportArrival SHALL 查询活动记录
5. IF 活动记录不存在，THEN THE reportArrival SHALL 返回错误码 1003
6. WHEN 活动记录存在时，THE reportArrival SHALL 校验调用者是活动发起人或拥有状态为 `approved` 的参与记录
7. IF 调用者既不是发起人也不是已通过的参与者，THEN THE reportArrival SHALL 返回错误码 1002
8. WHEN 身份校验通过且调用者为参与者时，THE reportArrival SHALL 将 `arrivedAt`（当前服务器时间）和 `arrivedLocation`（`{ latitude, longitude }`）更新到参与记录中
9. WHEN 身份校验通过且调用者为发起人时，THE reportArrival SHALL 将 `arrivedAt` 和 `arrivedLocation` 更新到活动记录中
10. WHEN 位置记录完成后，THE reportArrival SHALL 使用 Haversine_Formula 计算调用者坐标与活动地点坐标的距离
11. WHEN 距离计算完成后，THE reportArrival SHALL 返回 `{ code: 0, data: { success: true, distance } }`，其中 distance 为距离值（米）

### 需求 4：核销码展示页（参与者视角）

**用户故事：** 作为参与者，我希望在手机上展示动态核销码，以便在线下向发起人出示完成核销。

#### 验收标准

1. WHEN 核销码页面加载时，THE 核销码页面 SHALL 从页面参数中获取 `activityId`
2. WHEN 获取到 `activityId` 后，THE 核销码页面 SHALL 调用 generateQrToken 云函数获取 Token
3. WHEN Token 获取成功后，THE 核销码页面 SHALL 使用 QR 码生成库将 Token 字符串渲染为二维码图片并居中展示
4. WHEN 二维码展示后，THE 核销码页面 SHALL 显示 60 秒倒计时，每秒更新显示剩余秒数
5. WHEN 倒计时到达 10 秒时，THE 核销码页面 SHALL 自动调用 generateQrToken 获取新 Token 并刷新二维码
6. THE 核销码页面 SHALL 在二维码下方显示提示文案"请向发起人出示此码"和"截图无效，请使用实时码"
7. THE 核销码页面 SHALL 在页面顶部显示活动标题
8. THE 核销码页面 SHALL 提供"我已到达现场"按钮
9. WHEN 用户点击"我已到达现场"按钮时，THE 核销码页面 SHALL 调用 `wx.getLocation` 获取当前坐标，并调用 reportArrival 云函数上报位置
10. WHEN reportArrival 调用成功后，THE 核销码页面 SHALL 将按钮状态变更为"已报告到达 ✓"并禁用按钮，防止重复点击
11. WHEN 页面离开（onUnload）时，THE 核销码页面 SHALL 清除倒计时定时器，防止内存泄漏

### 需求 5：扫码核销页（发起人视角）

**用户故事：** 作为发起人，我希望扫描参与者的核销码完成验证，以便确认参与者到场并触发退款。

#### 验收标准

1. WHEN 扫码核销页加载时，THE 扫码核销页 SHALL 从页面参数中获取 `activityId`
2. WHEN 获取到 `activityId` 后，THE 扫码核销页 SHALL 查询该活动的所有参与记录并展示核销状态列表
3. WHEN 展示核销状态列表时，THE 扫码核销页 SHALL 对每条参与记录显示：已核销的显示"✅ 用户昵称 核销时间"，未核销的显示"⏳ 用户昵称 待核销"
4. THE 扫码核销页 SHALL 显示提示文案"请扫描参与者的核销码"
5. WHEN 用户点击扫码区域或扫码按钮时，THE 扫码核销页 SHALL 调用 `wx.scanCode` 启动扫码功能
6. WHEN `wx.scanCode` 成功返回扫码结果后，THE 扫码核销页 SHALL 调用 verifyQrToken 云函数并传入扫码获取的 Token
7. WHEN verifyQrToken 返回成功时，THE 扫码核销页 SHALL 显示绿色对勾成功动画，并刷新参与者核销状态列表
8. IF verifyQrToken 返回错误码 4001，THEN THE 扫码核销页 SHALL 显示"核销码无效或已过期，请让参与者刷新"提示
9. IF verifyQrToken 返回错误码 1002，THEN THE 扫码核销页 SHALL 显示"仅活动发起人可核销"提示
10. IF verifyQrToken 返回错误码 1004，THEN THE 扫码核销页 SHALL 显示"参与者状态异常"提示
11. THE 扫码核销页 SHALL 提供"我已到达现场"按钮，功能与核销码页面的到达按钮一致
12. WHEN 发起人点击"我已到达现场"按钮时，THE 扫码核销页 SHALL 调用 `wx.getLocation` 获取坐标并调用 reportArrival 上报位置
13. WHEN reportArrival 调用成功后，THE 扫码核销页 SHALL 将按钮变更为"已报告到达 ✓"并禁用
