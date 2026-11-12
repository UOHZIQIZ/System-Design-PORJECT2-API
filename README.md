# Study Studio — API only

从线上 Study Studio 的后端源码提取的独立本地版（源版本：`2d99dfc6`）。没有网页界面，也不包含线上用户数据。API 路径和主要业务逻辑保留；本地用 SQLite 和磁盘文件替代线上 D1 与 R2。**尚未连接 MongoDB。**

## 在 Mac 上运行

用 VS Code 打开解压后的文件夹，在终端确认 `node -v` 是 v24 或更新，然后执行：

```sh
npm start
```

不需要安装 npm 依赖。服务只监听本机的 `http://127.0.0.1:3000`。首次运行会创建 `.data/`，重启后测试数据仍保留。用 Bruno 发送请求时，添加 Header：`X-Demo-User: student`。这是本地演示身份；也可换成 `teammate` 或 `outsider` 测试访问权限。不要把这个演示登录用于线上部署。

## 用 Bruno 演示笔记 API

下面的路径都加在 `http://127.0.0.1:3000` 后面。写入和删除请求选择 JSON Body（`Content-Type: application/json`）。

| 请求 | JSON Body | 结果 |
|---|---|---|
| POST /api/records | `{"id":"demo-note-1","kind":"note","title":"System Design","body":"My first note"}` | 保存一条笔记 |
| GET /api/records | 无 | 返回该用户的记录列表 |
| PUT /api/records | `{"id":"demo-note-1","kind":"note","title":"Updated title","body":"My first note"}` | 替换该条记录内容；保留需要的字段 |
| DELETE /api/records | `{"id":"demo-note-1"}` | 永久删除这条记录；删除后再 GET 验证 |

网站回收站通过保存或清除记录的 `deletedAt` 字段实现。GET 返回这些记录供客户端区分。直接调用 DELETE 是永久删除。

## 其他接口

| 接口 | 用途 |
|---|---|
| GET/POST /api/collaboration | 列出或读取共享笔记；创建文档、管理邀请和成员、保存版本、发聊天消息、移入回收站、恢复或永久删除。 |
| GET/POST /api/collaboration/files | 读取和上传共享附件。上传用 multipart 字段 `file`、查询参数 `room`，并设置 `Origin: http://127.0.0.1:3000`。 |
| GET/POST/DELETE /api/images | 读取、上传和删除个人笔记图片。上传用 multipart 字段 `file`；读取用上传结果返回的 URL。 |
| GET /api/citations/doi?doi=10.1038/nature12373 | 调用第三方 Crossref 获取出版信息。需要网络。 |

协作演示：用 student 向 `POST /api/collaboration` 发送 `{"action":"create","title":"Group notes","template":"meeting","language":"en"}`，记下返回的 `id`。用同一接口发送 `{"action":"enableLink","room":"替换成上一步的ID"}` 取得 `shareToken`。再以 teammate 发送 `{"action":"joinLink","room":"替换成文档ID","token":"替换成shareToken"}`。之后 teammate 可用 `GET /api/collaboration?room=文档ID` 读取笔记。未加入的 outsider 会得到 404。

`src/api/` 是业务接口代码，`src/server.mjs` 是本地 HTTP 入口，`src/storage.mjs` 是本地存储层。以后接 MongoDB 时，需要把存储层和这些接口中的 SQL 查询改成 MongoDB 操作；只填连接字符串不会切换数据库。
