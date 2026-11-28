import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import pluginVueA11y from 'eslint-plugin-vuejs-accessibility'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'public/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  // 无障碍：模板层面的 a11y 规则（alt / label / 鼠标事件必须有键盘等价 / role 合法性…）
  ...pluginVueA11y.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    rules: {
      'vue/multi-word-component-names': 'off',
      // 浏览器全局交给 TypeScript 判定
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'vue/no-mutating-props': 'warn',
      // label 只要「包裹控件」或「id+for」二者之一即视为已关联（本项目多用包裹写法，
      // 这在 HTML/AT 语义上完全等价；默认要求两者同时满足会产出大量假阳性）
      'vuejs-accessibility/label-has-for': [
        'error',
        { required: { some: ['nesting', 'id'] } },
      ],
    },
  },
)
