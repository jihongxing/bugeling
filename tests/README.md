# 不鸽令 - 测试套件

本目录包含"不鸽令"小程序的全部自动化测试，采用单元测试 + 属性基测试（PBT）双重策略。

## 测试框架

- **Jest** v29 — JavaScript 测试框架
- **fast-check** v3 — 属性基测试库（每个属性最少 100 次随机迭代）

## 运行测试

```bash
cd tests
npm install
npm test                    # 运行全部测试（67 套件，713 用例）
npm run test:coverage       # 生成覆盖率报告
npx jest <pattern>          # 运行匹配的测试文件
```

## 测试统计

| 类别 | 测试套件 | 测试用例 |
|------|----------|----------|
| 总计 | 67 | 713 |

## 测试文件索引

### 共享模块测试

| 文件 | 模块 | 测试内容 |
|------|------|----------|
| `distance.pbt.test.js` | `_shared/distance.js` | Haversine 距离非负性、对称性、同点为零；到场判定正确性 |
| `distance.unit.test.js` | `_shared/distance.js` | haversineDistance 别名导出、已知距离验证、对称性 |
| `calendar.pbt.test.js` | `_shared/calendar.js` | 日历状态映射完整性（Property 1）：四种状态返回值、优先级规则 |
| `credit.test.js` | `_shared/credit.js` | calculateNewScore、calculateStatus、getCredit、updateCredit、checkAccess |
| `credit.pbt.test.js` | `_shared/credit.js` | 信用分计算属性、状态阈值映射 |
| `safety.test.js` | `_shared/safety.js` | checkText/checkImage 返回格式、errCode 映射 |
| `safety.pbt.test.js` | `_shared/safety.js` | 安全检测返回格式一致性、errCode 到 safe 映射正确性 |
| `validator.test.js` | `_shared/validator.js` | 字符串/枚举/整数范围/位置/时间校验 |
| `validator.pbt.test.js` | `_shared/validator.js` | 校验器属性测试 |
| `pagination.test.js` | `_shared/pagination.js` | 分页 skip/limit/hasMore 计算 |
| `pagination.pbt.test.js` | `_shared/pagination.js` | 分页逻辑属性（Property 6） |
| `config.test.js` | `_shared/config.js` | 环境变量读取健壮性 |

### 云函数测试

| 文件 | 云函数 | 测试内容 |
|------|--------|----------|
| `createActivity.test.js` | createActivity | 参数校验、内容安全、信用检查、创建流程 |
| `createActivity.pbt.test.js` | createActivity | 创建活动属性测试 |
| `getActivityList.test.js` | getActivityList | 列表查询、分页 |
| `getActivityList.pbt.test.js` | getActivityList | 列表查询属性测试 |
| `getActivityDetail.test.js` | getActivityDetail | 详情查询、wechatId 解锁、权限 |
| `getActivityDetail.pbt.test.js` | getActivityDetail | wechatId 条件解锁、myParticipation 条件返回 |
| `approveParticipant.test.js` | approveParticipant | 审批流程、权限、状态检查 |
| `approveParticipant.pbt.test.js` | approveParticipant | 审批属性测试 |
| `rejectParticipant.test.js` | rejectParticipant | 拒绝流程、退款触发 |
| `rejectParticipant.pbt.test.js` | rejectParticipant | 拒绝操作状态变更属性 |
| `createDeposit.pbt.test.js` | createDeposit | 押金创建属性测试 |
| `payCallback.pbt.test.js` | payCallback | 支付回调状态同步、幂等性 |
| `refundDeposit.pbt.test.js` | refundDeposit | 退款属性测试 |
| `splitDeposit.pbt.test.js` | splitDeposit | 分账金额不变量、完整操作 |
| `generateQrToken.test.js` | generateQrToken | 参数校验、JWT 生成、过期时间 |
| `generateQrToken.pbt.test.js` | generateQrToken | 核销码生成属性测试 |
| `verifyQrToken.test.js` | verifyQrToken | JWT 验证、身份校验、核销流程 |
| `verifyQrToken.pbt.test.js` | verifyQrToken | 核销验证属性测试 |
| `reportArrival.test.js` | reportArrival | 参数校验、身份校验、到达记录 |
| `reportArrival.pbt.test.js` | reportArrival | 到达报告属性测试 |
| `autoArbitrate.test.js` | autoArbitrate | 仲裁逻辑 |
| `autoArbitrate.pbt.test.js` | autoArbitrate | 仲裁裁决完整性、信用分操作、资金操作 |
| `getCreditInfo.test.js` | getCreditInfo | 信用等级描述、云函数响应 |
| `getCreditInfo.pbt.test.js` | getCreditInfo | 信用等级映射属性 |
| `getMyActivities.pbt.test.js` | getMyActivities | 排序属性、分页逻辑 |
| `submitReport.test.js` | submitReport | 参数校验、权限、图片安全、记录创建 |
| `checkImageSafety.test.js` | checkImageSafety | 图片安全检测 |
| `complianceRate.pbt.test.js` | getCalendarActivities | 守约率计算正确性（Property 3） |
| `checkConflict.pbt.test.js` | checkConflict | 时间重叠检测（Property 4）、间隔计算（Property 5） |
| `getPosterData.pbt.test.js` | getPosterData | 海报文案生成（Property 8）、击败百分比（Property 9） |

### 前端工具测试

| 文件 | 模块 | 测试内容 |
|------|------|----------|
| `api.test.js` | `utils/api.js` | 云函数调用错误标准化 |
| `auth.test.js` | `utils/auth.js` | 登录态缓存幂等性 |
| `location.test.js` | `utils/location.js` | 距离计算、格式化 |
| `format.pbt.test.js` | `utils/format.js` | 押金金额格式化正确性 |
| `status.pbt.test.js` | `utils/status.js` | 状态标签映射完整性 |
| `social.test.js` | `utils/social.js` | wechatId 解锁逻辑、倒计时计算 |
| `social.pbt.test.js` | `utils/social.js` | 解锁逻辑属性、倒计时属性 |
| `date.pbt.test.js` | `utils/date.js` | 日历天数计算（Property 10）、日期键格式（Property 2） |
| `haversineDistance.pbt.test.js` | `_shared/distance.js` | Haversine 距离基本性质（Property 6） |
| `monthSwitch.pbt.test.js` | calendar 页面逻辑 | 月份切换正确性（Property 7） |

### 页面辅助函数测试

| 文件 | 模块 | 测试内容 |
|------|------|----------|
| `detail-helpers.pbt.test.js` | detail/helpers.js | 按钮状态决策正确性 |
| `detail-payment.pbt.test.js` | detail/helpers.js | 报名按钮显示条件、金额格式化 |
| `create-helpers.pbt.test.js` | create/helpers.js | 最小可选时间计算 |
| `manage-helpers.pbt.test.js` | manage/helpers.js | 参与者操作按钮显示规则 |
| `validate-form.pbt.test.js` | create/validate.js | 表单校验完整性 |
| `pagination-state.pbt.test.js` | 分页状态管理 | 分页状态管理正确性 |
| `scan-helpers.pbt.test.js` | scan 页面辅助 | 参与者状态格式化、错误码映射 |
| `credit-badge.test.js` | credit-badge 组件 | 颜色等级映射 |
| `credit-badge.pbt.test.js` | credit-badge 组件 | 信用徽章颜色映射属性 |
| `formatCountdown.test.js` | detail/helpers.js | 倒计时格式化 |
| `determineVerdict.test.js` | autoArbitrate | 仲裁裁决函数 |
| `pay-utils.pbt.test.js` | `_shared/pay.js` | 分账金额不变量、订单号唯一性、签名验证 |
| `executeSplit.test.js` | executeSplit | 分账执行 |

## Mock 说明

`__mocks__/wx-server-sdk.js` 提供了 `wx-server-sdk` 的完整 mock，包括：
- `cloud.init()`、`cloud.getWXContext()`
- `cloud.database()` 及其链式调用（collection/where/doc/get/add/update/count）
- `cloud.openapi.security.msgSecCheck`
- `db.command`（gte/lte/eq/inc/in）
- `db.serverDate()`、`db.Geo.Point()`

## 属性基测试（PBT）说明

属性基测试通过 fast-check 生成大量随机输入，验证代码的通用正确性属性。每个属性测试文件头部标注了对应的 Feature 和 Property 编号，以及验证的需求编号（Validates: Requirements X.X）。

核心正确性属性：
- Property 1: 日历状态颜色映射完整性
- Property 2: 日期分组键格式正确性
- Property 3: 守约率计算正确性
- Property 4: 时间段重叠检测正确性
- Property 5: 时间段间隔计算正确性
- Property 6: Haversine 距离计算基本性质
- Property 7: 月份切换逻辑正确性
- Property 8: 海报文案生成正确性
- Property 9: 击败百分比计算正确性
- Property 10: 日历天数计算正确性
