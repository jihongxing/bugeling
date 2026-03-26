# 需求文档 - 活动页面与组件

## 简介

本文档定义"不鸽令"微信小程序中活动管理前端页面和组件的需求。范围包括 4 个页面（首页活动列表、创建活动、活动详情、活动管理）和 2 个组件（活动卡片、押金标签）。所有页面依赖 Spec 1 提供的项目脚手架（全局样式、工具模块）和 Spec 2 提供的后端云函数。

## 术语表

- **Activity_List_Page**: 首页活动列表页面（`pages/index/index`），展示用户附近的活动
- **Create_Activity_Page**: 创建活动页面（`pages/activity/create/create`），提供活动发布表单
- **Activity_Detail_Page**: 活动详情页面（`pages/activity/detail/detail`），展示活动完整信息和操作按钮
- **Activity_Manage_Page**: 活动管理页面（`pages/activity/manage/manage`），发起人审批参与者
- **Activity_Card**: 活动卡片组件（`components/activity-card/activity-card`），列表中的活动摘要卡片
- **Deposit_Tag**: 押金标签组件（`components/deposit-tag/deposit-tag`），格式化展示押金金额
- **LBS_Module**: 位置服务模块（`utils/location.js`），提供定位和距离计算功能
- **API_Module**: 接口调用模块（`utils/api.js`），封装云函数调用
- **Deposit_Tier**: 押金档位，以分为单位的整数值（990/1990/2990/3990/4990）
- **POI_Picker**: 腾讯地图兴趣点选择器，通过 `wx.chooseLocation` 调用
- **Participation**: 参与记录对象，包含参与者状态信息
- **Contract_Declaration**: 契约声明区域，展示押金规则和违约条款

## 需求

### 需求 1：首页活动列表

**用户故事：** 作为用户，我希望在首页看到附近的活动列表，以便快速找到感兴趣的线下约见。

#### 验收标准

1. WHEN Activity_List_Page 加载时，THE Activity_List_Page SHALL 调用 LBS_Module 获取用户当前位置并在页面顶部显示位置名称
2. WHEN 用户点击位置旁的刷新按钮，THE Activity_List_Page SHALL 重新获取用户位置并刷新活动列表
3. WHEN 用户位置获取成功，THE Activity_List_Page SHALL 调用 getActivityList 云函数传入用户经纬度坐标获取附近活动
4. WHEN 活动列表数据返回，THE Activity_List_Page SHALL 使用 Activity_Card 组件渲染每条活动数据为可滚动列表
5. WHEN 用户下拉页面，THE Activity_List_Page SHALL 触发下拉刷新并重新加载活动列表
6. WHEN 用户滚动到列表底部且 hasMore 为 true，THE Activity_List_Page SHALL 加载下一页数据并追加到列表末尾
7. WHEN 活动列表为空，THE Activity_List_Page SHALL 显示空状态提示"附近暂无活动，去发起一个？"
8. WHEN 用户点击某个 Activity_Card，THE Activity_List_Page SHALL 导航到 Activity_Detail_Page 并传递 activityId 参数

### 需求 2：创建活动页面

**用户故事：** 作为用户，我希望通过表单发布一个新活动，以便邀请他人参加线下约见。

#### 验收标准

1. THE Create_Activity_Page SHALL 提供以下必填表单字段：活动主题（文本输入，2-50 字符）、地点（POI_Picker 选择）、见面时间（日期时间选择器）、参与人数（步进器，1-20）、押金档位（单选按钮组，¥9.9/¥19.9/¥29.9/¥39.9/¥49.9）、接头特征（文本输入，2-100 字符，placeholder "如：穿红色外套，戴黑帽"）、微信号（文本输入，placeholder "请输入微信号"）
2. WHEN 用户点击地点选择区域，THE Create_Activity_Page SHALL 调用 `wx.chooseLocation` 打开 POI_Picker 并在选择后显示地点名称
3. WHEN 用户选择见面时间，THE Create_Activity_Page SHALL 限制最早可选时间为当前时间加 2 小时
4. WHEN 用户选择押金档位，THE Create_Activity_Page SHALL 以主色（#FF6B35）填充选中项背景并以白色显示文字
5. WHEN 用户点击提交按钮且存在未填写的必填字段，THE Create_Activity_Page SHALL 阻止提交并提示用户补全信息
6. WHEN 用户点击提交按钮且所有字段校验通过，THE Create_Activity_Page SHALL 显示 loading 状态并调用 createActivity 云函数
7. WHEN createActivity 云函数返回成功，THE Create_Activity_Page SHALL 导航到 Activity_Detail_Page 并传递新创建的 activityId
8. WHEN createActivity 云函数返回错误码 2001，THE Create_Activity_Page SHALL 显示 toast "内容包含违规信息，请修改"
9. WHEN createActivity 云函数返回错误码 2002，THE Create_Activity_Page SHALL 显示 toast 展示服务端返回的具体错误信息

### 需求 3：活动详情页面

**用户故事：** 作为用户，我希望查看活动的完整信息，以便决定是否参加或管理该活动。

#### 验收标准

1. WHEN Activity_Detail_Page 加载时，THE Activity_Detail_Page SHALL 从页面参数中获取 activityId 并调用 getActivityDetail 云函数加载数据
2. WHEN 活动数据加载成功，THE Activity_Detail_Page SHALL 显示活动标题、发起人契约分、地点名称、见面时间、已报名人数/最大人数、接头特征
3. WHEN 活动数据加载成功，THE Activity_Detail_Page SHALL 在独立卡片区域以金额字号（40rpx Bold）突出显示押金金额
4. THE Activity_Detail_Page SHALL 在押金卡片下方显示 Contract_Declaration 区域，使用浅黄色背景（#FEF3C7）和边框高亮展示契约声明全文
5. WHEN 当前用户无 myParticipation 记录且非活动发起人，THE Activity_Detail_Page SHALL 显示"支付 ¥XX.X 报名"按钮（金额从 Deposit_Tier 格式化）
6. WHEN 当前用户存在 myParticipation 记录，THE Activity_Detail_Page SHALL 显示该用户的参与状态标签替代报名按钮
7. WHEN 当前用户是活动发起人，THE Activity_Detail_Page SHALL 显示"管理活动"按钮并在点击时导航到 Activity_Manage_Page
8. WHEN 活动数据中 wechatId 不为 null，THE Activity_Detail_Page SHALL 显示"复制发起人微信"按钮
9. WHEN 用户点击"复制发起人微信"按钮，THE Activity_Detail_Page SHALL 调用 `wx.setClipboardData` 将 wechatId 复制到剪贴板

### 需求 4：活动管理页面

**用户故事：** 作为活动发起人，我希望管理参与者的报名申请，以便筛选合适的参与者组队。

#### 验收标准

1. WHEN Activity_Manage_Page 加载时，THE Activity_Manage_Page SHALL 从页面参数中获取 activityId 并加载活动详情和参与者列表
2. WHEN 活动数据加载成功，THE Activity_Manage_Page SHALL 在页面顶部显示活动基本信息和当前/最大参与人数
3. WHEN 参与者列表加载成功，THE Activity_Manage_Page SHALL 显示每个参与记录及其状态标签
4. WHEN 参与记录状态为 paid，THE Activity_Manage_Page SHALL 在该记录旁显示"同意"和"拒绝"操作按钮
5. WHEN 发起人点击"同意"按钮，THE Activity_Manage_Page SHALL 调用 approveParticipant 云函数并在成功后刷新参与者列表
6. WHEN 发起人点击"拒绝"按钮，THE Activity_Manage_Page SHALL 调用 rejectParticipant 云函数并在成功后刷新参与者列表
7. IF approveParticipant 或 rejectParticipant 调用失败，THEN THE Activity_Manage_Page SHALL 显示 toast 提示错误信息

### 需求 5：活动卡片组件

**用户故事：** 作为用户，我希望在列表中快速浏览活动关键信息，以便高效筛选感兴趣的活动。

#### 验收标准

1. THE Activity_Card SHALL 接收 activity 对象作为组件属性
2. THE Activity_Card SHALL 显示以下信息：活动标题、押金金额（使用 Deposit_Tag 组件）、参与人数（当前/最大）、距离、见面时间、发起人契约分
3. WHEN 用户点击 Activity_Card，THE Activity_Card SHALL 触发自定义事件并传递 activityId 给父组件

### 需求 6：押金标签组件

**用户故事：** 作为用户，我希望清晰看到活动的押金金额，以便快速了解参与成本。

#### 验收标准

1. THE Deposit_Tag SHALL 接收 amount 属性（Number 类型，单位为分，如 990、1990）
2. WHEN amount 属性传入，THE Deposit_Tag SHALL 将分转换为元并以"¥X.X"格式显示（如 990 显示为"¥9.9"）
3. THE Deposit_Tag SHALL 使用主色（#FF6B35）作为背景色、白色文字、标签圆角（8rpx）样式

### 需求 7：表单校验

**用户故事：** 作为用户，我希望在提交前得到明确的校验反馈，以便快速修正错误。

#### 验收标准

1. WHEN 活动主题长度小于 2 或大于 50 字符，THE Create_Activity_Page SHALL 提示"活动主题需 2-50 个字符"
2. WHEN 未选择地点，THE Create_Activity_Page SHALL 提示"请选择活动地点"
3. WHEN 未选择见面时间，THE Create_Activity_Page SHALL 提示"请选择见面时间"
4. WHEN 未选择押金档位，THE Create_Activity_Page SHALL 提示"请选择鸽子费档位"
5. WHEN 接头特征长度小于 2 或大于 100 字符，THE Create_Activity_Page SHALL 提示"接头特征需 2-100 个字符"
6. WHEN 微信号为空，THE Create_Activity_Page SHALL 提示"请输入微信号"

### 需求 8：状态标签展示

**用户故事：** 作为用户，我希望通过颜色标签快速识别活动或参与记录的状态。

#### 验收标准

1. WHEN 状态为 pending，THE Activity_Detail_Page 和 Activity_Manage_Page SHALL 显示黄色背景（#FEF3C7）、深黄文字（#D97706）的"待组队"标签
2. WHEN 状态为 confirmed，THE Activity_Detail_Page 和 Activity_Manage_Page SHALL 显示蓝色背景（#DBEAFE）、蓝色文字（#2563EB）的"已成行"标签
3. WHEN 状态为 verified，THE Activity_Detail_Page 和 Activity_Manage_Page SHALL 显示绿色背景（#D1FAE5）、绿色文字（#059669）的"已核销"标签
4. WHEN 状态为 expired，THE Activity_Detail_Page 和 Activity_Manage_Page SHALL 显示红色背景（#FEE2E2）、红色文字（#DC2626）的"已超时"标签
5. WHEN 状态为 settled，THE Activity_Detail_Page 和 Activity_Manage_Page SHALL 显示灰色背景（#E5E7EB）、灰色文字（#6B7280）的"已结算"标签
