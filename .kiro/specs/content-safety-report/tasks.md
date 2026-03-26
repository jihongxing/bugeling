# 实现计划：内容安全与举报系统

## 概述

基于设计文档，按增量方式实现内容安全共享模块、安全检测云函数、举报提交云函数、举报页面前端和社交解锁增强逻辑。每个任务构建在前一个任务之上，确保无孤立代码。

## 任务

- [x] 1. 实现 _shared/safety.js 内容安全共享模块
  - [x] 1.1 创建 `cloudfunctions/_shared/safety.js`，实现 `checkText(text)` 方法
    - 调用 `cloud.openapi.security.msgSecCheck({ content: text })`
    - errCode 为 0 返回 `{ safe: true, errCode: 0, errMsg: 'ok' }`
    - errCode 非 0 返回 `{ safe: false, errCode, errMsg }`
    - 异常时返回 `{ safe: false, errCode: -1, errMsg: '安全检测服务异常' }`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - [x] 1.2 在 `safety.js` 中实现 `checkImage(fileID)` 方法
    - 通过 `cloud.downloadFile({ fileID })` 下载图片
    - 调用 `cloud.openapi.security.imgSecCheck({ media: { contentType: 'image/png', value: imageBuffer } })`
    - 返回格式与 checkText 一致
    - 异常时返回 `{ safe: false, errCode: -1, errMsg: '图片安全检测服务异常' }`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  - [x]* 1.3 编写 safety.js 属性测试
    - **Property 1: 安全检测返回格式一致性**
    - **Property 2: 安全检测 errCode 到 safe 的映射正确性**
    - **Validates: Requirements 1.1, 1.3, 1.4, 2.1, 2.4, 2.5**

- [x] 2. 实现 _shared/social.js 社交解锁共享模块
  - [x] 2.1 创建 `cloudfunctions/_shared/social.js`，实现 `shouldUnlockWechatId(participationStatus, meetTime, now)` 和 `getUnlockCountdown(meetTime, now)` 纯函数
    - shouldUnlockWechatId: 仅当 status==='approved' 且 0 < meetTime-now <= 2h 时返回 true
    - getUnlockCountdown: meetTime-now > 2h 返回差值减 2h；否则返回 0
    - 导出 TWO_HOURS_MS 常量
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9_
  - [x]* 2.2 编写 social.js 属性测试
    - **Property 7: shouldUnlockWechatId 解锁逻辑完整性**
    - **Property 8: getUnlockCountdown 倒计时计算正确性**
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.7, 5.8, 5.9**

- [x] 3. 检查点 - 确保共享模块测试通过
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 4. 实现 checkTextSafety 和 checkImageSafety 云函数
  - [x] 4.1 创建 `cloudfunctions/checkTextSafety/index.js` 和 `package.json`
    - 接收 text 参数，校验非空
    - 调用 `safety.checkText(text)` 返回结果
    - 使用 `_shared/response.js` 的 successResponse/errorResponse
    - _Requirements: 1.6_
  - [x] 4.2 创建 `cloudfunctions/checkImageSafety/index.js` 和 `package.json`
    - 接收 fileID 参数，校验非空
    - 调用 `safety.checkImage(fileID)` 返回结果
    - 使用 `_shared/response.js` 的 successResponse/errorResponse
    - _Requirements: 2.7_

- [x] 5. 实现 submitReport 云函数
  - [x] 5.1 创建 `cloudfunctions/submitReport/index.js` 和 `package.json`
    - 通过 WX_Context 获取调用者 openId
    - 参数校验：activityId、type（枚举）、images（1-3项）、latitude/longitude（数字）、description（可选，≤200字符）
    - 权限校验：查询 participations 确认调用者为 approved 参与者
    - 图片安全检测：遍历 images 调用 safety.checkImage，任一失败返回 2001
    - 创建 report 记录到 reports 集合
    - 返回 { reportId, status: 'submitted' }
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_
  - [x]* 5.2 编写 submitReport 属性测试和单元测试
    - **Property 3: submitReport 参数校验正确性**
    - **Property 4: submitReport 权限校验正确性**
    - **Property 5: submitReport 图片安全门控**
    - **Property 6: 举报记录创建完整性**
    - **Validates: Requirements 3.2, 3.3, 3.5, 3.7, 3.8, 6.1, 6.2**

- [x] 6. 检查点 - 确保云函数测试通过
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 7. 实现举报页面前端
  - [x] 7.1 创建 `miniprogram/pages/report/report.js`、`report.wxml`、`report.wxss`、`report.json`
    - onLoad 接收 activityId 参数
    - onLoad 调用 wx.getLocation 获取坐标，失败时禁用提交
    - 举报类型单选按钮组（initiator_absent / mismatch / illegal）
    - 描述 textarea，200 字符限制，显示字数
    - 图片上传：wx.chooseImage + wx.cloud.uploadFile，1-3 张
    - 图片预览和删除功能
    - 提交按钮：前端校验 → 调用 submitReport → 处理响应
    - 成功 Toast "举报已提交" + navigateBack
    - 错误码 2001 Toast "图片包含违规内容"
    - 其他错误 Toast "举报提交失败，请重试"
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12, 4.13_

- [x] 8. 实现活动详情页社交解锁增强
  - [x] 8.1 在 `miniprogram/pages/activity/detail/detail.js` 中添加倒计时逻辑
    - 实现 `formatCountdown(ms)` 纯函数，将毫秒转为 "X小时X分钟" 文案
    - 复制 social.js 的 shouldUnlockWechatId 和 getUnlockCountdown 纯函数到前端（或提取为 utils/social.js）
    - 在 onShow 中启动定时器（setInterval 每分钟更新）
    - 在 onHide 中清除定时器
    - 在 WXML 中条件显示 "距解锁微信号还有 X小时X分钟" 文案
    - _Requirements: 5.10_
  - [x]* 8.2 编写 formatCountdown 单元测试
    - 测试边界情况：0ms、59分钟、1小时、2小时、负数
    - _Requirements: 5.10_

- [x] 9. 最终检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请向用户确认。

## 备注

- 标记 `*` 的子任务为可选测试任务，可跳过以加速 MVP
- 每个任务引用具体需求编号以确保可追溯性
- 检查点确保增量验证
- 属性测试验证通用正确性属性，单元测试验证具体示例和边界情况
- social.js 的纯函数需在前端复制一份（或提取到 miniprogram/utils/social.js），因为云函数共享模块无法直接在小程序前端引用
