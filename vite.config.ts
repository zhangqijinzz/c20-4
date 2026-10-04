import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// vitest 复用本配置；test 字段类型由 vitest/config 注入，这里直接在 vite 的 UserConfig 上做结构化扩展
const config = {
  plugins: [react()],
  test: {
    environment: 'jsdom' as const,
    setupFiles: ['./vitest.setup.ts'],
  },
}

export default defineConfig(config as Parameters<typeof defineConfig>[0])
