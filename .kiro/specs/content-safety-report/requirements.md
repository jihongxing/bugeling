# 需求文档 - 内容安全与举报系统

## 简介

本需求文档描述"不鸽令"微信小程序的内容安全审核、举报系统和社交解锁逻辑功能。该模块包含文本安全检测共享模块、图片安全检测云函数、举报提交云函数、举报页面前端，以及社交解锁（微信号显示倒计时）增强逻辑。内容安全模块为平台提供合规保障，举报系统为用户提供维权通道，社交解锁为参与者提供活动前的即时通讯能力。

## 术语表

- **Safety_Module**：内容安全共享模块（`_shared/safety.js`），提供文本和图片安全检测方法
- **CheckTextSafety**：文本安全检测云函数，调用微信 `msgSecCheck` 接口
- **CheckImageSafety**：图片安全检测云函数，调用微信 `imgSecCheck` 接口
- **SubmitReport**：举报提交云函数，处理用户举报请求
- **Report_Page**：举报页面（`pages/report/report`），用户提交举报的前端界面
- **Social_Module**：社交解锁共享模块（`_shared/social.js`），提供微信号解锁判断和倒计时计算
- **Report_Record**：举报记录，存储在 `reports` 集合中的数据文档
- **Approved_Participant**：已通过审批的参与者，参与记录状态为 `approved`
- **Content_Safety_API**：微信内容安全 API，包括 `msgSecCheck`（文本）和 `imgSecCheck`（图片）
- **Cloud_FileID**：微信云存储文件标识符，用于引用已上传的图片文件

## 需求

### 需求 1：文本安全检测

**用户故事：** 作为平台运营者，我希望对用户提交的文本内容进行安全审核，以确保平台内容合规。

#### 验收标准

1. THE Safety_Module SHALL 提供 `checkText(text)` 方法，接受字符串参数并返回 `{ safe: boolean, errCode: number, errMsg: string }` 格式的结果
2. WHEN `checkText` 接收到文本内容时，THE Safety_Module SHALL 调用微信 `cloud.openapi.security.msgSecCheck({ content: text })` 接口进行检测
3. WHEN 微信接口返回 errCode 为 0 时，THE Safety_Module SHALL 返回 `{ safe: true, errCode: 0, errMsg: 'ok' }`
4. WHEN 微信接口返回 errCode 为非 0 值时，THE Safety_Module SHALL 返回 `{ safe: false, errCode, errMsg }`
5. IF 微信接口调用发生异常，THEN THE Safety_Module SHALL 返回 `{ safe: false, errCode: -1, errMsg: '安全检测服务异常' }`
6. THE CheckTextSafety 云函数 SHALL 作为独立可调用的云函数封装 Safety_Module 的 `checkText` 方法

### 需求 2：图片安全检测

**用户故事：** 作为平台运营者，我希望对用户上传的图片进行安全审核，以防止违规图片出现在平台上。

#### 验收标准

1. THE Safety_Module SHALL 提供 `checkImage(fileID)` 方法，接受云存储 Cloud_FileID 参数并返回 `{ safe: boolean, errCode: number, errMsg: string }` 格式的结果
2. WHEN `checkImage` 接收到 Cloud_FileID 时，THE Safety_Module SHALL 从云存储下载该图片文件获取 Buffer 数据
3. WHEN 图片下载成功后，THE Safety_Module SHALL 调用微信 `cloud.openapi.security.imgSecCheck({ media: { contentType: 'image/png', value: imageBuffer } })` 接口进行检测
4. WHEN 微信接口返回 errCode 为 0 时，THE Safety_Module SHALL 返回 `{ safe: true, errCode: 0, errMsg: 'ok' }`
5. WHEN 微信接口返回 errCode 为非 0 值时，THE Safety_Module SHALL 返回 `{ safe: false, errCode, errMsg }`
6. IF 图片下载失败或微信接口调用发生异常，THEN THE Safety_Module SHALL 返回 `{ safe: false, errCode: -1, errMsg: '图片安全检测服务异常' }`
7. THE CheckImageSafety 云函数 SHALL 作为独立可调用的云函数封装 Safety_Module 的 `checkImage` 方法

### 需求 3：举报提交

**用户故事：** 作为活动参与者，我希望能够举报违规行为（发起人未到场、人货不符、非法交易），以保障自身权益。

#### 验收标准

1. WHEN 调用 SubmitReport 时，THE SubmitReport SHALL 通过 `cloud.getWXContext().OPENID` 获取调用者身份
2. WHEN 接收到举报参数时，THE SubmitReport SHALL 校验以下字段：activityId（必填字符串）、type（必填，枚举值 `initiator_absent` / `mismatch` / `illegal`）、images（必填数组，1-3 个 Cloud_FileID）、latitude（必填数字）、longitude（必填数字）、description（选填字符串，最多 200 字符）
3. IF 参数校验失败，THEN THE SubmitReport SHALL 返回错误码 1001 和具体的校验失败信息
4. WHEN 参数校验通过后，THE SubmitReport SHALL 查询调用者在该活动中的参与记录，确认其为 Approved_Participant
5. IF 调用者不是该活动的 Approved_Participant，THEN THE SubmitReport SHALL 返回错误码 1002
6. WHEN 权限校验通过后，THE SubmitReport SHALL 对 images 数组中的每张图片调用 Safety_Module 的 `checkImage` 方法进行安全检测
7. IF 任一图片未通过安全检测，THEN THE SubmitReport SHALL 返回错误码 2001 和消息"图片包含违规内容"
8. WHEN 所有图片通过安全检测后，THE SubmitReport SHALL 在 reports 集合中创建 Report_Record，包含字段：activityId、reporterId（调用者 openId）、type、description、images、location（`{ latitude, longitude }`）、status（`submitted`）、createdAt（服务器时间戳）
9. WHEN Report_Record 创建成功后，THE SubmitReport SHALL 返回 `{ reportId, status: 'submitted' }`
10. IF 数据库操作发生异常，THEN THE SubmitReport SHALL 返回错误码 5001

### 需求 4：举报页面

**用户故事：** 作为活动参与者，我希望通过一个简洁的页面提交举报信息（类型、描述、图片、位置），以便快速反馈违规行为。

#### 验收标准

1. WHEN 用户进入 Report_Page 时，THE Report_Page SHALL 通过页面参数接收 activityId
2. WHEN Report_Page 加载时，THE Report_Page SHALL 调用 `wx.getLocation` 自动获取用户当前经纬度坐标
3. IF 获取位置失败，THEN THE Report_Page SHALL 显示提示"请开启位置权限以提交举报"并禁用提交按钮
4. THE Report_Page SHALL 显示举报类型单选按钮组，包含三个选项：发起人未到场（`initiator_absent`）、人货不符（`mismatch`）、非法交易（`illegal`）
5. THE Report_Page SHALL 显示可选的描述输入框（textarea），限制最多 200 字符，并显示当前字数
6. THE Report_Page SHALL 提供图片上传功能，允许用户通过 `wx.chooseImage` 选择 1-3 张图片
7. WHEN 用户选择图片后，THE Report_Page SHALL 将图片通过 `wx.cloud.uploadFile` 上传至云存储并获取 Cloud_FileID
8. WHEN 用户点击提交按钮时，THE Report_Page SHALL 校验：已选择举报类型、已上传 1-3 张图片、已获取位置坐标
9. IF 前端校验失败，THEN THE Report_Page SHALL 显示对应的错误提示（如"请选择举报类型"、"请至少上传1张图片"）
10. WHEN 前端校验通过后，THE Report_Page SHALL 调用 SubmitReport 云函数提交举报数据
11. WHEN SubmitReport 返回成功时，THE Report_Page SHALL 显示 Toast "举报已提交" 并调用 `wx.navigateBack` 返回上一页
12. WHEN SubmitReport 返回错误码 2001 时，THE Report_Page SHALL 显示 Toast "图片包含违规内容"
13. WHEN SubmitReport 返回其他错误时，THE Report_Page SHALL 显示 Toast "举报提交失败，请重试"

### 需求 5：社交解锁逻辑

**用户故事：** 作为活动参与者，我希望在活动开始前 2 小时自动解锁发起人的微信号，以便进行最后的即时沟通。

#### 验收标准

1. THE Social_Module SHALL 提供 `shouldUnlockWechatId(participationStatus, meetTime, now)` 方法，返回 boolean 值
2. WHEN participationStatus 为 `approved` 且 meetTime 减去 now 小于等于 2 小时 且 meetTime 大于 now 时，THE Social_Module 的 `shouldUnlockWechatId` SHALL 返回 true
3. WHEN participationStatus 不为 `approved` 时，THE Social_Module 的 `shouldUnlockWechatId` SHALL 返回 false
4. WHEN meetTime 减去 now 大于 2 小时时，THE Social_Module 的 `shouldUnlockWechatId` SHALL 返回 false
5. WHEN meetTime 小于等于 now（活动已过期）时，THE Social_Module 的 `shouldUnlockWechatId` SHALL 返回 false
6. THE Social_Module SHALL 提供 `getUnlockCountdown(meetTime, now)` 方法，返回距解锁剩余的毫秒数
7. WHEN meetTime 减去 now 大于 2 小时时，THE Social_Module 的 `getUnlockCountdown` SHALL 返回 meetTime 减去 now 再减去 2 小时的毫秒数
8. WHEN meetTime 减去 now 小于等于 2 小时且 meetTime 大于 now 时，THE Social_Module 的 `getUnlockCountdown` SHALL 返回 0（已解锁）
9. WHEN meetTime 小于等于 now 时，THE Social_Module 的 `getUnlockCountdown` SHALL 返回 0
10. THE Report_Page 所在的活动详情页 SHALL 在微信号未解锁时显示倒计时文案"距解锁微信号还有 X小时X分钟"

### 需求 6：举报数据模型

**用户故事：** 作为系统开发者，我希望举报记录有清晰的数据结构，以支持举报流程和后续审核。

#### 验收标准

1. THE Report_Record SHALL 包含以下必填字段：_id（string，自动生成）、activityId（string）、reporterId（string）、type（string，枚举 `initiator_absent` / `mismatch` / `illegal`）、images（array，1-3 个 Cloud_FileID）、location（object，包含 latitude 和 longitude）、status（string，初始值 `submitted`）、createdAt（Date，服务器时间戳）
2. THE Report_Record SHALL 包含以下可选字段：description（string，最多 200 字符）
3. THE Report_Record 的 status 字段 SHALL 支持以下枚举值：`submitted`（已提交）、`reviewing`（审核中）、`confirmed`（已确认）、`rejected`（已驳回）
