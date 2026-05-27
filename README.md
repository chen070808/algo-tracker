# OI Life Tracker

OI Life Tracker 是一个面向算法学习者的 Chrome 扩展：自动记录你的刷题提交，把 LeetCode、洛谷、牛客上的练习转成 Elo、热力图、知识点弱项和下一步建议。

![Popup](docs/popup.png)

## 支持平台

| 平台 | 检测状态 | 当前能力 |
| --- | --- | --- |
| LeetCode CN | 可用 | 题目页提交检测、代码保存、标签映射 |
| LeetCode | 可用 | 题目页提交检测、代码保存、标签映射 |
| 牛客 | 可用 | DOM 检测、提交记录保存、标签映射 |
| 洛谷 | 测试中 | 题目页/记录页检测、GraphQL/API fallback |

## 安装方式

Chrome 商店链接：待上架。

开发者模式安装：

```bash
npm install
npm run build
```

然后打开 `chrome://extensions`，启用“开发者模式”，点击“加载已解压的扩展程序”，选择 `algo-tracker/dist`。

## 核心功能

- 自动追踪：在支持平台提交后自动保存题目、结果、语言、代码和时间。
- Elo 评分：按全局和知识点分别计算能力值，持续观察提升。
- 知识图谱：把平台标签映射到统一的算法知识节点，定位真实弱项。
- 热力图：用 7 天和全年视图记录训练节奏，避免只看题量。

## 隐私承诺

- 默认数据只保存在本地浏览器 IndexedDB。
- 不会自动上传你的代码、提交记录或个人数据。
- 云同步和 GitHub 同步都需要你主动配置并触发。
- 导出 JSON 和清空数据都在本地完成。

## 项目文档

- 产品与路线：[`../OI_Life/`](../OI_Life/)
- 知识图谱：[`../shared/knowledge-graph.json`](../shared/knowledge-graph.json)
- RAG 内容工具：[`../rag_system/`](../rag_system/)

