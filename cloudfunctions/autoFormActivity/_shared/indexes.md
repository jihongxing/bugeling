# 数据库索引配置

本文档记录需要在微信云开发控制台手动创建的数据库索引。

## 索引列表

### 1. activities.location（2dsphere 地理位置索引）

- 集合：`activities`
- 字段：`location`
- 索引类型：`2dsphere`
- 用途：支持 `getActivityList` 云函数的 GEO 范围查询（geoNear 聚合）

### 2. activities.status + meetTime（复合索引）

- 集合：`activities`
- 字段：`status`（升序）+ `meetTime`（升序）
- 索引类型：复合索引
- 用途：按状态过滤活动并按见面时间排序，支持过期活动扫描

### 3. participations.activityId + status（复合索引）

- 集合：`participations`
- 字段：`activityId`（升序）+ `status`（升序）
- 索引类型：复合索引
- 用途：按活动 ID 查询特定状态的参与记录，支持 approve/reject 操作

## 创建步骤

1. 登录 [微信云开发控制台](https://cloud.weixin.qq.com/)
2. 进入对应环境 → 数据库
3. 选择目标集合（activities 或 participations）
4. 点击「索引管理」→「添加索引」
5. 按上述配置填写字段和索引类型
6. 点击确认创建

> 注意：2dsphere 索引要求 `location` 字段存储为 `db.Geo.Point` 格式，创建活动时已按此格式写入。
