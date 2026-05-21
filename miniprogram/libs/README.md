# 第三方库说明

当前小程序不依赖腾讯地图 JS SDK 文件。

地图选点使用微信原生 `wx.chooseLocation`，当前位置补全使用
`miniprogram/utils/location.js` 里的腾讯位置服务 WebService 逆地理接口。

## 腾讯地图配置

1. 在腾讯位置服务控制台申请 Key。
2. 在 Key 管理中启用 WebServiceAPI 和微信小程序能力。
3. 将 Key 写入本地私有配置 `miniprogram/config/local.private.js`。
4. 在微信小程序后台 request 合法域名中配置 `https://apis.map.qq.com`。

本目录暂时不需要放置 `qqmap-wx-jssdk.min.js`。
