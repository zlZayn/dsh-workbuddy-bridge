/** The plugin's dictionary: one key union, two bundles, no ad-hoc objects. */

import type { SettingsFormLabels } from '@deepseek-ai/dsh-client-ui-primitives'

/** Every copy key the browser half renders. */
export type WorkBuddyLocaleKey =
  // Card frame
  | 'title' | 'intro' | 'titleAI' | 'introAI'
  // Account state
  | 'loading' | 'signedOut' | 'signedOutHint' | 'signedOutHintAI' | 'signedIn' | 'signedInAs' | 'accessTokenExpires'
  | 'accountHeading' | 'modelsHeading' | 'contextHeading'
  // Read failures
  | 'requestFailed' | 'statusRefreshFailed' | 'statusResponseInvalid'
  // Catalog provenance
  | 'catalogLive' | 'catalogSaved' | 'catalogFallback' | 'catalogError' | 'catalogAppVersion'
  // Actions
  | 'refresh' | 'refreshing' | 'refreshModels' | 'refreshingModels'
  // Tabs
  | 'tabLabel' | 'tabStatus' | 'tabContext' | 'tabDetails'
  // Credit
  | 'creditsHeading' | 'creditsDetailHeading' | 'creditsTotal' | 'creditsTotalUnlimited'
  | 'unlimitedQuota' | 'packageEnterprise' | 'cycleResetAt' | 'percentRemaining' | 'percentUnknown'
  | 'exactRemaining' | 'creditPackageUnknownSize' | 'creditsError'
  // Model offers
  | 'freeModel' | 'badgeLimitedFree' | 'badgeNightDiscount' | 'badgeFreeNow' | 'rate' | 'rateUnknown'
  // Context window
  | 'contextUpTo' | 'contextDefault' | 'contextUnknown'
  // Model visibility
  | 'visibilityIntro' | 'visibilityStaleAccount'
  // Reasoning-effort detection
  | 'probeHeading' | 'probeIntro' | 'probeConsentHint' | 'probeStart' | 'probeRedetect'
  | 'probeRunning' | 'probeRunningGeneric' | 'probeClear' | 'probeConfirmBody'
  | 'probeResultVerified' | 'probeResultNotValidating' | 'probeResultUnknown' | 'probeResultAt'
  | 'probeResultEmpty' | 'probeResultNoLevels' | 'probeFailed'
  // The composer control's own panel. Unlike the card, it has one action and no
  // confirmation step: the panel explains, the button acts.
  | 'probePanelLevels' | 'probePanelNone' | 'probePanelNote' | 'probePanelDetect'
  | 'probePanelDetecting' | 'probePanelRedetect' | 'probePanelNotValidating' | 'probePanelFailed'
  | 'probeLabel' | 'probeTooltipIdle' | 'probeTooltipLevels' | 'probeTooltipNotValidating'
  | 'probeTooltipFailed'
  // Settings form
  | 'authFile' | 'authFileHint' | 'authFileAI' | 'authFileAIHint'
  | 'probeConsent' | 'maximumContextWindow' | 'maximumContextWindowHint' | 'on' | 'off'
  | 'overridden' | 'reset' | 'readOnly' | 'unavailable' | 'save' | 'saving' | 'saveFailed'
  // Agent assist
  | 'assistantHeading' | 'assistantIntro' | 'assistantCopy' | 'assistantCopied'
  | 'assistantCopyFailed' | 'assistantAfter' | 'assistantRecheck' | 'assistantRechecking'
  | 'assistantPrompt' | 'assistNotFound' | 'assistAmbiguous' | 'assistIncomplete'
  | 'assistPathInvalid' | 'assistUnavailableCN' | 'assistUnavailableAI'

/** English copy. */
export const en: Record<WorkBuddyLocaleKey, string> = {
  title: 'WorkBuddy (CN)',
  intro: 'Follows the sign-in of the WorkBuddy desktop app and serves its models here.',
  titleAI: 'WorkBuddy AI (Global)',
  introAI: 'Follows the sign-in of the WorkBuddy AI desktop app and serves its models here.',
  loading: 'Loading account…',
  signedOut: 'Not signed in',
  signedOutHint: 'Sign in once in the WorkBuddy desktop app; this plugin follows that sign-in automatically.',
  signedOutHintAI: 'Sign in once in the WorkBuddy AI desktop app; this plugin follows that sign-in automatically.',
  signedIn: 'Signed in',
  signedInAs: 'Signed in as {nickname}',
  accessTokenExpires: 'Access token expires {time} (refresh is automatic)',
  accountHeading: 'Account',
  modelsHeading: 'Model offers',
  contextHeading: 'Context window',
  requestFailed: 'Request failed',
  statusRefreshFailed: 'Refresh failed: {message} — showing the last known state',
  statusResponseInvalid: 'WorkBuddy returned an unreadable status reply',
  catalogLive: 'Model list updated {time}',
  catalogSaved: 'Showing the saved model list from {time}',
  catalogFallback: 'Showing the built-in model list (not yet updated from WorkBuddy)',
  catalogError: 'Last update failed: {message}',
  catalogAppVersion: 'App version {version}',
  refresh: 'Refresh',
  refreshing: 'Refreshing…',
  refreshModels: 'Refresh model list',
  refreshingModels: 'Refreshing models…',
  tabLabel: 'WorkBuddy detail',
  tabStatus: 'Status',
  tabContext: 'Context window',
  tabDetails: 'Credit details',
  creditsHeading: 'Remaining credit',
  creditsDetailHeading: 'By package',
  creditsTotal: 'Total: {total}',
  creditsTotalUnlimited: 'Total: Unlimited',
  unlimitedQuota: 'Unlimited',
  packageEnterprise: 'Enterprise quota',
  cycleResetAt: 'Resets {time}',
  percentRemaining: '{percent}% remaining',
  percentUnknown: 'Remaining share unknown',
  exactRemaining: '{remain} / {size} remaining',
  creditPackageUnknownSize: '{remain} remaining',
  creditsError: 'Credit unavailable: {message}',
  freeModel: 'Free',
  badgeLimitedFree: 'Limited-time free',
  badgeNightDiscount: 'Night discount',
  badgeFreeNow: 'Free now',
  rate: '{rate} credits per message',
  rateUnknown: 'Price unavailable — refresh to update',
  contextUpTo: 'up to {size}',
  contextDefault: 'default {size}',
  contextUnknown: 'no declared context window',
  visibilityIntro: 'Uncheck a model to hide it from the model picker. Saved per signed-in account; chats already using a hidden model keep working.',
  visibilityStaleAccount: 'The signed-in account changed — this change was not saved.',
  probeHeading: 'Reasoning effort detection',
  probeIntro: 'Some models reason but declare no selectable effort levels. Detecting which levels a model accepts sends a few real requests that may consume credit.',
  probeConsentHint: 'Each detection sends test requests to one model to confirm its available reasoning levels, and may consume a small amount of credit.',
  probeStart: 'Detect',
  probeRedetect: 'Detect again',
  probeRunning: 'Detecting {model}…',
  probeRunningGeneric: 'Detecting…',
  probeClear: 'Clear detected results',
  probeConfirmBody: 'Send test requests to {model} to confirm its available reasoning levels. May consume a small amount of credit.',
  probeResultVerified: 'Verified levels: {levels}',
  probeResultNotValidating: 'This model does not check the effort parameter',
  probeResultUnknown: 'Detection did not complete',
  probeResultAt: 'Detected {time}',
  probeResultEmpty: 'No detectable models right now.',
  probeResultNoLevels: 'No tested levels were accepted.',
  probeFailed: 'Detection failed: {message}',
  probeLabel: 'Reasoning levels',
  probePanelLevels: 'Supported levels',
  probePanelNone: 'Not detected yet',
  probePanelNote: 'Detection sends a few requests to this model and may consume a small amount of credit.',
  probePanelDetect: 'Detect',
  probePanelDetecting: 'Detecting…',
  probePanelRedetect: 'Detect again',
  probePanelNotValidating: 'This model ignores the reasoning-level parameter.',
  probePanelFailed: 'Detection did not finish. You can run it again.',
  probeTooltipIdle: 'Detect the reasoning levels {model} supports',
  probeTooltipLevels: 'Supported levels: {levels}',
  probeTooltipNotValidating: 'This model ignores the reasoning-level parameter',
  probeTooltipFailed: 'Detection did not finish · click to run it again',
  authFile: 'WorkBuddy auth file',
  authFileHint: 'Path to the WorkBuddy desktop auth file. Leave blank to use the app’s own location.',
  authFileAI: 'WorkBuddy AI auth file',
  authFileAIHint: 'Path to the WorkBuddy AI desktop auth file. Leave blank to use the app’s own location.',
  probeConsent: 'Allow reasoning-effort detection',
  maximumContextWindow: 'Use the largest declared context window',
  maximumContextWindowHint: 'Applies to WorkBuddy AI models that offer a larger window.',
  on: 'on',
  off: 'off',
  overridden: 'Overridden',
  reset: 'Reset to default',
  readOnly: 'This deployment stores settings read-only.',
  unavailable: 'This plugin is not loaded, so it cannot be configured right now.',
  save: 'Save',
  saving: 'Saving…',
  saveFailed: 'The deployment did not accept these values; they were left for you to correct.',
  assistantHeading: 'Let an Agent sort this out',
  assistantIntro: 'Send the request below to your Agent; it will check the app location and the launch configuration for you.',
  assistantCopy: 'Copy for Agent',
  assistantCopied: 'Copied',
  assistantCopyFailed: 'Copy failed — select the text above and copy it manually',
  assistantAfter: 'When your Agent is done, come back and check again. If the DSH launch environment was changed, restart DSH first as instructed.',
  assistantRecheck: 'Done — check again',
  assistantRechecking: 'Checking…',
  // The prompt is a request to the user's Agent, not a promise by this plugin:
  // it must not name a specific env var (the right fix depends on how DSH was
  // launched) and must not claim a search happened.
  assistantPrompt: 'DSH\'s dsh-workbuddy-bridge cannot use my {appName}: {failureSummary}. Please check the actual installation location and any existing path configuration, help the plugin use it correctly, and verify recovery. If the DSH launch environment must be changed or DSH restarted, give me clear steps; do not only set an environment variable temporarily in the current shell.',
  // Per-code summaries. `unavailable*` says only that nothing is configured —
  // never that a search was performed, because on those paths none was.
  assistNotFound: 'no usable decryption program was found',
  assistAmbiguous: 'more than one WorkBuddy copy was found and none could be chosen safely',
  assistIncomplete: 'the automatic search could not be completed',
  assistPathInvalid: 'the configured program path is not usable',
  assistUnavailableCN: 'no decryption program is configured for this platform',
  assistUnavailableAI: 'no decryption program is configured for WorkBuddy AI',
}

/** Simplified Chinese copy. */
export const zh: Record<WorkBuddyLocaleKey, string> = {
  title: 'WorkBuddy（国内版）',
  intro: '跟随 WorkBuddy 桌面 App 的登录状态，在此直接使用它的模型。',
  titleAI: 'WorkBuddy AI（国际版）',
  introAI: '跟随 WorkBuddy AI 桌面 App 的登录状态，在此直接使用它的模型。',
  loading: '正在读取账号…',
  signedOut: '未登录',
  signedOutHint: '在 WorkBuddy 桌面 App 里登录一次即可，插件会自动跟随当前登录的账号。',
  signedOutHintAI: '在 WorkBuddy AI 国际版桌面 App 里登录一次即可，插件会自动跟随当前登录的账号。',
  signedIn: '已登录',
  signedInAs: '已登录：{nickname}',
  accessTokenExpires: '访问令牌 {time} 过期（自动续期）',
  accountHeading: '账号',
  modelsHeading: '模型优惠',
  contextHeading: '上下文窗口',
  requestFailed: '请求失败',
  statusRefreshFailed: '刷新失败：{message} — 当前显示的是上次成功获取的状态',
  statusResponseInvalid: 'WorkBuddy 返回的状态数据无法识别',
  catalogLive: '模型列表更新于 {time}',
  catalogSaved: '当前显示已保存的模型列表，更新于 {time}',
  catalogFallback: '当前显示内置模型列表（尚未从 WorkBuddy 更新）',
  catalogError: '上次更新失败：{message}',
  catalogAppVersion: 'App 版本 {version}',
  refresh: '刷新',
  refreshing: '正在刷新…',
  refreshModels: '刷新模型列表',
  refreshingModels: '正在刷新模型…',
  tabLabel: 'WorkBuddy 详情',
  tabStatus: '状态',
  tabContext: '上下文窗口',
  tabDetails: '积分详情',
  creditsHeading: '剩余积分',
  creditsDetailHeading: '按套餐',
  creditsTotal: '合计：{total}',
  creditsTotalUnlimited: '合计：不限额',
  unlimitedQuota: '不限额',
  packageEnterprise: '企业额度',
  cycleResetAt: '重置时间：{time}',
  percentRemaining: '剩余 {percent}%',
  percentUnknown: '剩余占比未知',
  exactRemaining: '剩余 {remain} / {size}',
  creditPackageUnknownSize: '剩余 {remain}',
  creditsError: '积分查询失败：{message}',
  freeModel: '免费',
  badgeLimitedFree: '限时免费',
  badgeNightDiscount: '夜间折扣',
  badgeFreeNow: '限时免费',
  rate: '{rate} 积分/次',
  rateUnknown: '价格未知 — 刷新后更新',
  contextUpTo: '最高 {size}',
  contextDefault: '默认 {size}',
  contextUnknown: '未声明上下文窗口',
  visibilityIntro: '取消勾选即可在模型选择器中隐藏该模型；按当前登录账号分别保存，已在用该模型的会话不受影响。',
  visibilityStaleAccount: '登录账号已切换——本次修改未保存。',
  probeHeading: '推理档位检测',
  probeIntro: '部分模型具备思考能力，但没有声明可选档位。检测会发送少量真实请求，可能消耗积分。',
  probeConsentHint: '每次检测会向该模型发送探测请求，以确认可用推理档位，可能消耗少量积分。',
  probeStart: '开始检测',
  probeRedetect: '重新检测',
  probeRunning: '正在检测 {model}…',
  probeRunningGeneric: '正在检测…',
  probeClear: '清除已探测结果',
  probeConfirmBody: '向 {model} 发送探测请求，以确认可用推理档位。可能消耗少量积分。',
  probeResultVerified: '已验证接受的档位：{levels}',
  probeResultNotValidating: '该模型不校验该参数',
  probeResultUnknown: '检测未完成',
  probeResultAt: '检测于 {time}',
  probeResultEmpty: '当前没有可检测的模型。',
  probeResultNoLevels: '本次测试的档位均未被接受。',
  probeFailed: '检测失败：{message}',
  probeLabel: '推理档位',
  probePanelLevels: '支持的档位',
  probePanelNone: '尚未检测',
  probePanelNote: '检测会向该模型发送若干请求，可能消耗少量积分。',
  probePanelDetect: '检测',
  probePanelDetecting: '检测中…',
  probePanelRedetect: '重新检测',
  probePanelNotValidating: '该模型忽略推理档位参数。',
  probePanelFailed: '检测未完成，可以再检测一次。',
  probeTooltipIdle: '检测 {model} 支持的推理档位',
  probeTooltipLevels: '支持的档位：{levels}',
  probeTooltipNotValidating: '该模型忽略推理档位参数',
  probeTooltipFailed: '检测未完成 · 点击可再检测一次',
  authFile: 'WorkBuddy 登录文件',
  authFileHint: 'WorkBuddy 桌面 App 登录文件的路径。留空表示使用应用自身的位置。',
  authFileAI: 'WorkBuddy AI 登录文件',
  authFileAIHint: 'WorkBuddy AI 桌面 App 登录文件的路径。留空表示使用应用自身的位置。',
  probeConsent: '允许推理档位检测',
  maximumContextWindow: '使用上游声明的最大上下文窗口',
  maximumContextWindowHint: '仅作用于 WorkBuddy AI 中声明了更大窗口的模型。',
  on: '开',
  off: '关',
  overridden: '已覆盖',
  reset: '恢复默认',
  readOnly: '本部署的设置为只读。',
  unavailable: '该插件当前未加载，暂时无法配置。',
  save: '保存',
  saving: '保存中…',
  saveFailed: '本部署没有接受这些值，已保留供你修改。',
  assistantHeading: '让 Agent 帮你处理',
  assistantIntro: '把下面这段请求发给你的 Agent，它会协助检查应用位置和启动配置。',
  assistantCopy: '复制给 Agent',
  assistantCopied: '已复制',
  assistantCopyFailed: '复制失败，请手动选择上方文字复制',
  assistantAfter: 'Agent 处理完成后，回到这里重新检查；如果修改了 DSH 的启动环境，请先按指引重启 DSH。',
  assistantRecheck: '已处理，重新检查',
  assistantRechecking: '正在检查…',
  assistantPrompt: 'DSH 的 dsh-workbuddy-bridge 无法使用我的 {appName}：{failureSummary}。请帮我检查实际安装位置和已有路径配置，让插件能正确使用它，并验证恢复结果；如果需要修改 DSH 的启动环境或重启，请给我明确的操作步骤，不要只在当前 shell 临时设置环境变量。',
  assistNotFound: '没有找到可用的解密程序',
  assistAmbiguous: '找到了多个 WorkBuddy 副本，无法安全自动选择',
  assistIncomplete: '自动定位未能完成',
  assistPathInvalid: '指定的程序路径不可用',
  assistUnavailableCN: '当前平台尚未配置解密程序',
  assistUnavailableAI: '尚未配置 WorkBuddy AI 的解密程序',
}

/**
 * The dictionary reader a component takes.
 *
 * Narrower than DSH's own `Translate` on purpose: every call site in this
 * plugin names one of the keys above, so an unknown key is a compile error
 * rather than a rendered key name.
 */
export type WorkBuddyTranslate = (key: WorkBuddyLocaleKey, params?: Record<string, unknown>) => string

/** The form frame's copy, read from this plugin's dictionary. */
export function formLabels(t: (key: WorkBuddyLocaleKey) => string): SettingsFormLabels {
  return { unavailable: t('unavailable'), readOnly: t('readOnly'), saveFailed: t('saveFailed'), save: t('save'), saving: t('saving') }
}
