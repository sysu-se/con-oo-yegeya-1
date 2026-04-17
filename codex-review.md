# con-oo-yegeya-1 - Review

## Review 结论

代码已经有“把领域对象接入 Svelte”的明确尝试，开始游戏、用户输入、撤销重做、状态持久化也基本围绕 Game/Sudoku 组织；但当前实现仍存在结构性缺陷：接入层本身出现双实现拼接，领域对象没有真正承载数独规则校验、固定格不可修改和胜利判定等核心业务，因此整体更接近“用 store 包装棋盘和历史”，而不是成熟的领域模型驱动 UI。

## 总体评价

| 维度 | 评价 |
| --- | --- |
| OOP | fair |
| JS Convention | poor |
| Sudoku Business | poor |
| OOD | poor |

## 缺点

### 1. 兼容层文件被两套实现拼接，Svelte 接入层失去单一事实来源

- 严重程度：core
- 位置：src/node_modules/@sudoku/stores/grid.js:1-57,74-415
- 原因：同一个 ESM 文件里重复声明 import、_initialGrid、grid、userGrid、undo/redo 等绑定。按 JS 模块语义，这已经是重复词法声明的高风险结构；即使先不看能否构建成功，UI 也在依赖一个含两套逻辑的适配层，而不是清晰、唯一的 Game Store。

### 2. 数独规则校验和胜利判定没有进入领域对象

- 严重程度：core
- 位置：src/domain/index.js:113-128,160-191; src/node_modules/@sudoku/stores/game.js:7-18
- 原因：Sudoku.guess 只校验坐标和值范围，isSolved 只判断是否填满；真正的冲突检测和胜利判定仍在 Svelte store 中基于原始二维数组推导。这样 Game/Sudoku 没有承担作业要求中的“校验能力”和业务核心，UI 仍然拥有关键规则。

### 3. 固定格不可修改这一核心业务约束放在适配层而非领域层

- 严重程度：core
- 位置：src/stores/gamestore.js:15-20,32-39,167-172; src/domain/index.js:113-119
- 原因：_fixed 由 store 根据初始盘面或历史自行推导，userGrid.set 先判断 fixed 再调用 game.guess；但 Sudoku/Game 自身允许直接改任意格子。数独最基础的 givens 不可变约束没有被对象模型保护，任何绕过 store 的调用都会破坏业务一致性。

### 4. 适配层直接窥探 Game.history，职责边界反向耦合

- 严重程度：major
- 位置：src/stores/gamestore.js:32-39; src/domain/index.js:149-184
- 原因：gamestore 为了恢复 initial grid 直接读取 game.history[0]，说明 UI 适配层依赖了 Game 的内部存储策略，而不是通过稳定的领域接口获取“初始题面/固定格”视图。这样一旦 history 表示法变化，Svelte 接层会跟着破裂，OOD 边界较弱。

### 5. Game.guess 在确认操作成功前就写入历史

- 严重程度：major
- 位置：src/domain/index.js:160-163
- 原因：当前实现先 push 当前快照并清空 future，再调用 Sudoku.guess。若 move 非法，或未来扩展出更多失败场景，历史仍会被污染，undo/redo 语义与实际成功操作不一致。作为 UI 总入口，这个命令接口不够稳健。

### 6. Undo/Redo 已导出可用状态，但按钮仍未消费响应式能力

- 严重程度：minor
- 位置：src/components/Controls/ActionBar/Actions.svelte:29-36; src/stores/gamestore.js:238-246
- 原因：适配层已经提供 canUndo/canRedo，组件却只在暂停时禁用按钮，无法把领域历史状态准确反馈到 UI。功能入口虽然接上了 Game，但没有完整用上 Svelte store 的声明式状态，交互反馈偏弱。

## 优点

### 1. 采用了 Store Adapter，把领域命令转换成 Svelte 可消费状态

- 位置：src/stores/gamestore.js:25-30,161-185,228-245
- 原因：通过 writable 保存 Game snapshot，再导出 userGrid、canUndo、canRedo 等响应式状态和 undo/redo 命令，这与作业推荐的 adapter 方案一致，方向是正确的。

### 2. 主要游戏流程已经尝试经过统一入口，而不是散落在组件里直接改数组

- 位置：src/node_modules/@sudoku/game.js:13-34; src/components/Modal/Types/Welcome.svelte:32-41; src/components/Controls/Keyboard.svelte:10-25
- 原因：开始新局、自定义题面和键盘输入都走 grid.generate、grid.decodeSencode 或 userGrid.set 等接口，说明接入真实 UI 的意识是有的，主要交互没有完全留在组件局部状态中。

### 3. 领域对象提供了克隆与序列化接口，便于历史和持久化复用

- 位置：src/domain/index.js:131-145,195-225
- 原因：Sudoku/Game 提供 clone、toJSON/fromJSON、serialize/deserialize，使 undo/redo、localStorage 和分享码可以围绕同一套快照机制组织，接口设计有一定完整性。

### 4. 棋盘渲染以 userGrid 为主，当前局面来源相对统一

- 位置：src/components/Board/index.svelte:40-51
- 原因：Board 直接从 $userGrid 渲染当前盘面，而不是在组件内部再维护另一份用户棋盘。这使领域状态变化到视图刷新的路径比较清晰。

## 补充说明

- 本次结论仅基于静态审查，未运行测试，也未启动 Svelte 应用。
- 关于 src/node_modules/@sudoku/stores/grid.js 可能导致模块无效或构建失败的判断，来自对重复 import/const 声明的静态阅读，而非实际构建验证。
- 关于开始游戏、输入、撤销重做、胜利弹窗、分享恢复等流程是否真正接入，结论来自 App.svelte、@sudoku/game、@sudoku/stores/grid、src/stores/gamestore.js 及相关组件的调用链静态分析。
- 评审范围已限制在 src/domain/* 及其关联的 Svelte 接入代码，未扩展到无关目录。
