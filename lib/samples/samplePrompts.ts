export const samplePrompts = [
  {
    id: 'safe-red-right',
    title: 'Safe placement',
    prompt: '把红色方块移动到右侧安全区，但不要碰到玻璃杯。'
  },
  {
    id: 'blocked-throw',
    title: 'Unsafe throw',
    prompt: '快速把红色方块扔出桌面。'
  },
  {
    id: 'scan-sort',
    title: 'Scan and sort',
    prompt: '扫描桌面，把红色方块放右边，把蓝色方块放左边。'
  }
] as const;
