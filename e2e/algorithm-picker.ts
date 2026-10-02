import type { Page } from '@playwright/test'
const names: Record<string, string> = { dijkstra: 'Dijkstra', bidirectional: 'Bidirectional Dijkstra', astar: 'A*', 'bidirectional-astar': 'Bidirectional A*', greedy: 'Greedy best-first', 'depth-first': 'Depth-first', 'breadth-first': 'Breadth-first', 'spanning-tree': 'Spanning tree' }
export async function selectAlgorithm(page: Page, value: string) {
  await page.getByRole('combobox', { name: 'Search algorithm' }).click()
  await page.getByRole('option', { name: names[value], exact: true }).click()
}
