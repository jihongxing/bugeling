# 需求文档 - 项目脚手架初始化

## 简介

本需求定义"不鸽令"微信小程序项目的初始化脚手架工作，包括项目目录结构创建、全局样式定义、云开发初始化代码、工具函数封装以及应用配置。此 Spec 是整个项目的第一步，为后续业务功能开发奠定基础。

## 术语表

- **小程序前端 (Miniprogram_Frontend)**：`miniprogram/` 目录下的微信小程序前端代码，包含页面、组件、工具函数和静态资源
- **云函数层 (CloudFunction_Layer)**：`cloudfunctions/` 目录下的云开发后端代码，包含所有云函数和共享模块
- **API 工具 (API_Util)**：`miniprogram/utils/api.js`，对 `wx.cloud.callFunction` 的统一封装，提供标准错误处理
- **认证工具 (Auth_Util)**：`miniprogram/utils/auth.js`，管理用户登录态和 openId 获取
- **定位工具 (Location_Util)**：`miniprogram/utils/location.js`，封装 LBS 相关辅助函数（获取位置、距离计算等）
- **全局样式 (Global_Styles)**：`app.wxss` 中定义的全局 CSS 变量、字体规范和基础组件样式
- **项目配置 (Project_Config)**：`project.config.json`，微信开发者工具的项目级配置文件
- **应用配置 (App_Config)**：`app.json`，小程序的全局配置文件，包含页面路由、TabBar 和权限声明
- **共享模块 (Shared_Modules)**：`cloudfunctions/_shared/` 目录下的公共代码模块，供所有云函数复用
- **设计令牌 (Design_Tokens)**：UI 规范中定义的颜色、字号、间距、圆角等标准化数值

## 需求

### 需求 1：小程序前端目录结构

**用户故事：** 作为开发者，我希望项目具备完整的小程序前端目录结构，以便后续业务页面和组件的开发有统一的组织方式。

#### 验收标准

1. THE 小程序前端 SHALL 包含入口文件 `app.js`、`app.json`、`app.wxss`
2. THE 小程序前端 SHALL 包含以下页面目录，每个目录包含对应的 `.js`、`.json`、`.wxml`、`.wxss` 四个文件：`index`（首页）、`activity/create`（发布活动）、`activity/detail`（活动详情）、`activity/manage`（活动管理）、`verify/qrcode`（核销码展示）、`verify/scan`（扫码核销）、`user/profile`（个人中心）、`user/history`（历史记录）、`report`（举报页面）
3. THE 小程序前端 SHALL 包含以下组件目录，每个目录包含对应的 `.js`、`.json`、`.wxml`、`.wxss` 四个文件：`activity-card`（活动卡片）、`deposit-tag`（鸽子费标签）、`credit-badge`（信用分徽章）
4. THE 小程序前端 SHALL 包含 `utils/` 目录，存放 `api.js`、`auth.js`、`location.js` 工具模块
5. THE 小程序前端 SHALL 包含 `libs/` 目录，用于存放第三方 SDK（如腾讯地图 SDK）

### 需求 2：云函数目录结构

**用户故事：** 作为开发者，我希望云函数目录结构预先创建完毕，以便后续每个云函数的开发有独立的目录和统一的共享模块。

#### 验收标准

1. THE 云函数层 SHALL 包含以下云函数目录，每个目录包含 `index.js` 入口文件和 `package.json`：`createActivity`、`getActivityList`、`getActivityDetail`、`approveParticipant`、`rejectParticipant`、`createDeposit`、`payCallback`、`generateQrToken`、`verifyQrToken`、`reportArrival`、`autoArbitrate`、`executeSplit`、`getCreditInfo`、`submitReport`、`getMyActivities`
2. THE 云函数层 SHALL 包含 `_shared/` 共享模块目录，内含 `db.js`（数据库操作封装）、`config.js`（环境变量读取）、`pay.js`（微信支付封装）、`credit.js`（信用分操作封装）
3. WHEN 定时触发类云函数（`autoArbitrate`、`executeSplit`）被创建时，THE 云函数层 SHALL 在对应目录中包含 `config.json` 定时触发器配置文件

### 需求 3：全局样式定义

**用户故事：** 作为开发者，我希望全局样式按照 UI 规范预先定义好设计令牌和基础样式，以便所有页面和组件保持视觉一致性。

#### 验收标准

1. THE 全局样式 SHALL 定义以下颜色变量：主色 `#FF6B35`、辅助色 `#1A1A2E`、成功色 `#10B981`、警告色 `#F59E0B`、危险色 `#EF4444`、背景色 `#F5F5F7`、卡片背景 `#FFFFFF`、次要文字色 `#6B7280`
2. THE 全局样式 SHALL 定义以下字号变量：大标题 `36rpx`、标题 `32rpx`、正文 `28rpx`、辅助 `24rpx`、标签 `22rpx`、金额 `40rpx`
3. THE 全局样式 SHALL 定义以下间距和圆角变量：页面边距 `32rpx`、卡片内边距 `24rpx`、卡片间距 `20rpx`、卡片圆角 `16rpx`、按钮圆角 `12rpx`、标签圆角 `8rpx`、输入框圆角 `12rpx`
4. THE 全局样式 SHALL 定义基础组件样式类，包括：页面容器（`.page`）、卡片容器（`.card`）、主按钮（`.btn-primary`）、次按钮（`.btn-secondary`）、状态标签（`.tag`）的基础样式
5. THE 全局样式 SHALL 设置全局字体族为系统默认字体（`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`）

### 需求 4：云开发初始化

**用户故事：** 作为开发者，我希望 `app.js` 中包含云开发初始化代码，以便小程序启动时自动连接云开发环境。

#### 验收标准

1. WHEN 小程序启动时，THE 小程序前端 SHALL 在 `app.js` 的 `onLaunch` 生命周期中调用 `wx.cloud.init()`，配置 `traceUser: true` 并使用占位符标记云环境 ID
2. THE 小程序前端 SHALL 在 `app.js` 中提供全局数据存储（`globalData`），包含 `userInfo`（用户信息）和 `openId`（用户标识）字段

### 需求 5：API 工具封装

**用户故事：** 作为开发者，我希望有统一的云函数调用封装，以便所有页面调用云函数时具备标准的错误处理和 loading 提示。

#### 验收标准

1. THE API_Util SHALL 导出一个 `callFunction(name, data)` 方法，内部调用 `wx.cloud.callFunction` 并返回 Promise
2. WHEN 云函数调用失败时，THE API_Util SHALL 捕获异常并返回包含错误码和错误信息的标准化错误对象
3. THE API_Util SHALL 支持可选的 `showLoading` 参数，为 `true` 时在调用期间显示 `wx.showLoading` 并在完成后隐藏

### 需求 6：认证工具封装

**用户故事：** 作为开发者，我希望有统一的登录态管理工具，以便各页面方便地获取用户身份信息。

#### 验收标准

1. THE Auth_Util SHALL 导出一个 `login()` 方法，调用 `wx.cloud.callFunction` 获取用户 openId 并缓存到全局数据和本地存储
2. THE Auth_Util SHALL 导出一个 `getOpenId()` 方法，优先从缓存读取 openId，缓存不存在时自动调用 `login()`
3. WHEN 登录失败时，THE Auth_Util SHALL 返回包含错误信息的标准化错误对象，不中断应用运行

### 需求 7：定位工具封装

**用户故事：** 作为开发者，我希望有统一的 LBS 工具函数，以便各页面方便地获取用户位置和计算距离。

#### 验收标准

1. THE Location_Util SHALL 导出一个 `getCurrentLocation()` 方法，封装 `wx.getLocation` 并返回包含 `latitude` 和 `longitude` 的 Promise
2. THE Location_Util SHALL 导出一个 `calculateDistance(lat1, lng1, lat2, lng2)` 方法，使用 Haversine 公式计算两点间距离（单位：米）
3. THE Location_Util SHALL 导出一个 `formatDistance(meters)` 方法，将米数格式化为可读字符串（小于 1000 米显示 "Xm"，大于等于 1000 米显示 "X.Xkm"）
4. WHEN 用户拒绝位置授权时，THE Location_Util SHALL 返回明确的授权失败错误，并提供引导用户开启授权的提示信息

### 需求 8：应用配置

**用户故事：** 作为开发者，我希望 `app.json` 包含完整的页面路由、TabBar 配置和权限声明，以便小程序的导航结构和权限在项目初始化时就已就绪。

#### 验收标准

1. THE App_Config SHALL 声明所有 9 个页面的路由路径，首页 `pages/index/index` 为第一个路由
2. THE App_Config SHALL 配置 TabBar，包含三个标签页：首页（`pages/index/index`）、发布（`pages/activity/create/create`）、我的（`pages/user/profile/profile`），每个标签页包含文字和图标路径占位
3. THE App_Config SHALL 声明 `scope.userLocation` 权限，描述文案为"用于展示附近活动和到场校验"
4. THE App_Config SHALL 配置导航栏样式：背景色 `#FFFFFF`、文字色 `#1A1A2E`、标题"不鸽令"

### 需求 9：项目配置文件

**用户故事：** 作为开发者，我希望 `project.config.json` 正确配置云函数根目录和基本项目信息，以便微信开发者工具能正确识别项目结构。

#### 验收标准

1. THE Project_Config SHALL 配置 `cloudfunctionRoot` 字段指向 `cloudfunctions/` 目录
2. THE Project_Config SHALL 配置 `miniprogramRoot` 字段指向 `miniprogram/` 目录
3. THE Project_Config SHALL 包含 AppID 占位符和项目名称"不鸽令"

### 需求 10：共享模块骨架

**用户故事：** 作为开发者，我希望云函数共享模块有基础的骨架代码，以便后续业务云函数开发时可以直接引用。

#### 验收标准

1. THE Shared_Modules 的 `db.js` SHALL 导出一个获取数据库实例的方法和各集合名称常量（`activities`、`participations`、`credits`、`transactions`、`reports`）
2. THE Shared_Modules 的 `config.js` SHALL 导出一个读取环境变量的方法，支持读取 `WX_MCH_ID`、`WX_API_KEY`、`WX_API_V3_KEY`、`WX_NOTIFY_URL`、`JWT_SECRET`
3. THE Shared_Modules 的 `pay.js` SHALL 导出支付相关方法的骨架（`createOrder`、`refund`、`splitBill`），方法体包含 TODO 注释标记待实现
4. THE Shared_Modules 的 `credit.js` SHALL 导出信用分相关方法的骨架（`getCredit`、`updateCredit`、`checkAccess`），方法体包含 TODO 注释标记待实现
