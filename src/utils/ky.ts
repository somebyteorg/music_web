/**
 * 兼容出口：历史上各领域直接 import 这个 ky 实例。
 * 现在它就是 lib/api/client 里的同一个 http（同一套 CSRF/401/错误模型），
 * 新增代码请改用 lib/api 下的类型化 api 模块。
 */
export { http as default, http, setCsrfToken } from '@/lib/api/client'
