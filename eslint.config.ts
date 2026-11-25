import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'public/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    rules: {
      // 单文件页面/组件名不强制多词，保持现有命名
      'vue/multi-word-component-names': 'off',
      // 浏览器全局（document/ResizeObserver/HTMLInputElement…）交给 TypeScript 判定，
      // 否则每个用到 DOM 的文件都要维护一份 globals 清单
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // 历史遗留：批量整理对话框直接改 props 对象，先降级为告警，等重构时处理
      'vue/no-mutating-props': 'warn',
    },
  },
)
