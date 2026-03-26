# 第三方 SDK 说明

本目录用于存放第三方 SDK 文件。

## 腾讯地图 SDK

请从腾讯位置服务官网下载微信小程序 JavaScript SDK：
https://lbs.qq.com/miniProgram/jsSdk/jsSdkGuide/jsSdkOverview

下载后将 `qqmap-wx-jssdk.min.js` 文件放置在本目录下。

## 使用方式

在需要使用地图服务的页面中引入：

```javascript
const QQMapWX = require('../../libs/qqmap-wx-jssdk.min.js')

const qqmapsdk = new QQMapWX({
  key: 'YOUR_TENCENT_MAP_KEY'
})
```

## 注意事项

- 需要在腾讯位置服务控制台申请开发者密钥（key）
- 在小程序管理后台配置服务器域名白名单：`https://apis.map.qq.com`
