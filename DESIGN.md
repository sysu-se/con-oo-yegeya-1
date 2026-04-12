# DESIGN.md - Homework 1.1: 改进领域对象并接入 Svelte

## 概述

本次作业在 Homework 1 的基础上，进一步改进 `Sudoku` 和 `Game` 领域对象，并将其真正接入 Svelte 前端游戏流程。核心目标是让领域对象成为真实游戏的核心，而不是仅存在于测试中。

我们采用 **Store Adapter** 模式作为接入方式：建立面向 Svelte 的适配层，负责持有领域对象、对外暴露响应式状态，并提供 UI 可调用的方法。

## 文件结构

- `src/domain/index.js`: 领域对象 `Sudoku` 和 `Game`
- `src/stores/gamestore.js`: Store Adapter，封装领域对象与 Svelte Store 的适配
- `src/node_modules/@sudoku/stores/grid.js`: 兼容层，重新导出 gamestore 的接口

## 领域对象改进

### Sudoku 类

**职责：**
- 持有当前 9x9 grid 数据
- 提供 `guess(move)` 接口，支持用户输入
- 提供校验能力（通过 `isSolved()` 判断游戏完成）
- 支持序列化（`toJSON()` / `fromJSON()`）和克隆（`clone()`）
- 提供外表化能力（`toString()`）

**改进点：**
- 统一使用工厂函数 `createSudoku()` 初始化，避免直接 new
- 序列化格式包含版本号，便于未来扩展
- `guess()` 方法返回布尔值，表示操作是否成功

### Game 类

**职责：**
- 持有当前 `Sudoku` 实例
- 管理历史记录（`history` 数组）和未来记录（`future` 数组）
- 提供 `undo()` / `redo()` 接口
- 对外提供面向 UI 的游戏操作入口（`guess()`）
- 提供状态快照（`getStateSnapshot()`）用于响应式更新

**改进点：**
- 历史管理使用深克隆，避免引用污染
- 序列化包含完整历史，支持分享时恢复 undo/redo 状态
- `getStateSnapshot()` 返回面向 UI 的数据结构

## gamestore.js: Store Adapter 实现

### 核心职责

`gamestore.js` 是本次作业的核心文件，实现了完整的 Store Adapter：

1. **持有领域对象实例：** 全局 `sudoku` 和 `game` 实例
2. **Svelte Store 管理：** 使用 `writable()` 和 `derived()` 创建响应式状态
3. **同步机制：** `sync()` 函数确保领域对象变化后更新 Store
4. **序列化支持：** 完整的保存/恢复逻辑，包括分享码生成

### 关键实现

```javascript
// 领域对象实例
let sudoku = createSudoku(_initialGrid);
let game = createGame({ sudoku });

// Svelte Store
const { subscribe: gameSubscribe, set: gameSet } = writable(game.getStateSnapshot());

// 派生 Store
export const userGrid = derived(
  [{ subscribe: gameSubscribe }],
  ([$game]) => $game.grid
);

// 同步函数
function sync() {
  gameSet(game.getStateSnapshot());
  saveState();
}
```

### 分享功能实现

- `getShareableCode()`: 生成包含完整游戏状态的分享码
- `restoreFromShareCode()`: 从分享码恢复游戏状态
- 支持 URL hash 恢复和欢迎页面粘贴恢复

## Svelte 响应式机制与领域对象协作

### 协作方式

1. **领域对象变化触发 Store 更新：** 用户输入调用 `game.guess()` 后，立即执行 `sync()`
2. **Store 更新触发 derived 计算：** `userGrid` 重新计算 `$game.grid`
3. **Svelte 响应式系统刷新 UI：** 模板中的 `{#each $userGrid as row, y}` 重新渲染

### 为什么 UI 会更新

- **领域对象** 负责业务逻辑和状态管理
- **gamestore** 负责响应式通知和数据流
- **UI** 消费响应式数据和命令

### 如果错误地直接 mutate 对象，会出什么问题

如果直接修改领域对象的内部数组而不通过 `sync()`：

```javascript
// 错误做法
game.getSudoku().grid[0][0] = 5; // 直接修改
// UI 不会更新，因为 Store 没有收到通知
```

**问题：**
- Svelte 的响应式系统依赖于 Store 的 `set()` 调用
- 直接 mutate 对象属性不会触发订阅者更新
- UI 显示旧数据，用户体验不一致
- 可能导致状态不一致（Store 和领域对象脱节）

**解决方案：** 始终通过领域对象的公开接口操作，并调用 `sync()`。

## View 层消费领域对象

### 主要消费方式

1. **数据消费：**
   - `Board` 组件：`{#each $userGrid as row, y}` - 显示当前游戏局面
   - `Cell` 组件：接收 `value` 来自 `$userGrid[y][x]`

2. **命令消费：**
   - `Actions` 组件：撤销按钮 `on:click={undo}`，重做按钮 `on:click={redo}`
   - `Board` 组件：用户点击触发 `userGrid.set(pos, value)`

3. **状态消费：**
   - `invalidCells`：`derived` 自 `$userGrid`，用于高亮冲突格子

### 消费流程示例

**用户输入流程：**
1. 用户在键盘输入数字
2. `Keyboard` 组件调用 `userGrid.set({x, y}, value)`
3. `userGrid.set` 调用 `game.guess({row: y, col: x, value})`
4. `game.guess` 更新内部状态，推入历史
5. 调用 `sync()` 更新 Svelte Store
6. UI 自动刷新显示新状态

**Undo/Redo 流程：**
1. 用户点击撤销按钮
2. `Actions` 组件调用 `undo()`
3. `undo()` 调用 `game.undo()`
4. `game.undo()` 从历史恢复状态
5. 调用 `sync()` 更新 Store
6. UI 显示撤销后的状态

## 兼容性设计

### grid.js 兼容层

为了不破坏现有代码的导入，保留了 `src/node_modules/@sudoku/stores/grid.js` 作为兼容层：

- 导入 `gamestore.js` 的所有导出
- 重新导出以保持原有接口
- 只保留必要的 `grid` store（用于初始棋盘）

这样现有代码无需修改，所有 `import { userGrid, undo, redo } from '@sudoku/stores/grid'` 继续工作。

## 潜在问题和解决方案

### 问题 1: 性能考虑

**问题：** 每次 `sync()` 都会触发全 Board 重新渲染

**解决方案：**
- 使用 `getStateSnapshot()` 只返回必要数据
- 考虑局部更新优化（但本次作业未实现）

### 问题 2: 状态一致性

**问题：** localStorage 保存可能失败

**解决方案：**
- `saveState()` 用 try-catch 包装
- 失败时只记录警告，不中断游戏

### 问题 3: 序列化兼容性

**问题：** 未来版本可能改变序列化格式

**解决方案：**
- 序列化包含版本号
- 恢复时检查版本兼容性

## 总结

通过独立的 `gamestore.js` 文件，我们成功实现了：

- **领域对象** 完全封装在 Store Adapter 中
- **Svelte Store** 提供响应式接口
- **UI 层** 通过标准导入消费领域功能
- **向后兼容** 保证现有代码无需修改

这种设计既满足了作业要求，又保持了代码的可维护性和扩展性。