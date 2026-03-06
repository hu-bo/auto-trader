// Tailwind CSS 集成指南

## 已配置的 Tailwind 系统

### 文件结构
- `tailwind.config.ts` - Tailwind 配置（深色主题，Zinc & Emerald 调色板）
- `src/styles/tailwind.css` - Tailwind CSS 入口（@import "tailwindcss"）
- `src/lib/utils.ts` - `cn()` 工具函数用于合并类名
- `vite.config.ts` - 已配置 @tailwindcss/vite 插件

### 颜色系统
深色主题配色（参考用户提供的设计）：
- 背景：`bg-zinc-950` / `bg-zinc-900`
- 边框：`border-zinc-800`
- 文本：`text-zinc-200` / `text-zinc-500`
- 买入（多）：`text-emerald-500` / `bg-emerald-500/10`
- 卖出（空）：`text-rose-500` / `bg-rose-500/10`

### 批量引入 Tailwind 的组件

只需在 JSX 中使用 Tailwind 类：

```tsx
import { cn } from '@/lib/utils'

export const MyComponent = () => {
  const isActive = true
  
  return (
    <div className="flex flex-col gap-4 p-4 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-200">
      {/* Header */}
      <button
        className={cn(
          'px-3 py-1 text-xs font-medium rounded-md',
          isActive ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
        )}
      >
        按钮
      </button>

      {/* Input */}
      <input
        type="text"
        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm 
                   focus:outline-none focus:border-zinc-600 transition-colors text-zinc-200"
      />

      {/* Buy/Sell Button */}
      <button
        className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold"
      >
        买入
      </button>
    </div>
  )
}
```

### 已优化的组件

✅ **BatchStrategyOrderForm** 
- 完全使用 Tailwind CSS
- 深色主题，对标用户参考设计
- 包含所有交互：交易类型、方向、杠杆、金额、止损止盈
- 实时计算显示（入场价、止损价、止盈价）

### 下一步建议

1. **OrderForm 组件** - 可参考 BatchStrategyOrderForm 进行 Tailwind 迁移（当前使用 Semi-UI）
2. **全局样式** - 在 `src/styles/global.less` 或 `tailwind.css` 中添加全局定制
3. **响应式设计** - 使用 `md:`, `lg:` 前缀适配不同屏幕
4. **暗黑模式** - 可通过 `dark:` 前缀支持浅色主题

### 常用工具类速查

| 用途 | 类名示例 |
|------|--------|
| 间距 | `gap-4` `p-4` `mb-2` |
| 文本 | `text-xs` `text-center` `font-bold` `uppercase` |
| 边框 | `border` `border-zinc-800` `rounded-lg` |
| 背景 | `bg-zinc-950` `bg-emerald-500/10` |
| 过渡 | `transition-all` `hover:bg-zinc-800` |
| 状态 | `disabled:opacity-50` `active:scale-95` |
| 弹性布局 | `flex` `flex-col` `gap-2` `flex-1` |
| 栅格 | `grid` `grid-cols-2` `gap-2` |
