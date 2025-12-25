import { Layers, MousePointerClick, Sparkles } from 'lucide-react';

interface OnboardingPanelProps {
  onComplete: () => void;
  onSkip: () => void;
}

export default function OnboardingPanel({
  onComplete,
  onSkip,
}: OnboardingPanelProps) {
  return (
    <div className="h-full w-full px-6 pb-6 pt-2 flex flex-col">
      <header className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
            欢迎使用 LexiLens
          </h1>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            下面这份 1 分钟的新手引导会帮你快速熟悉「词汇教练」的工作方式。
          </p>
        </div>
        <button
          type="button"
          onClick={onSkip}
          className="text-[11px] text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline-offset-2 hover:underline"
        >
          稍后再说
        </button>
      </header>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {/* What is LexiLens */}
        <section className="glass glass-border rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-indigo-500" />
            </div>
            <div>
              <h2 className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                LexiLens 是什么？
              </h2>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                它不是简单的词典，而是会结合「你正在看的句子」和「你的水平/兴趣」给出分层解释的词汇教练。
              </p>
            </div>
          </div>

          <div className="mt-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-white/60 dark:bg-gray-900/40 px-3 py-2">
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              TODO: 截图占位 — 放一张完整侧边栏界面的截图，标注四个层次和个性化提示位置。
            </p>
          </div>
        </section>

        {/* How to trigger */}
        <section className="glass glass-border rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center">
              <MousePointerClick className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <h2 className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                如何唤起词汇教练？
              </h2>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                打开任意英文网页后：
              </p>
            </div>
          </div>

          <ol className="mt-1 list-decimal pl-5 space-y-1.5">
            <li className="text-[11px] text-gray-600 dark:text-gray-300">
              用鼠标选中你想弄懂的单词或短语。
            </li>
            <li className="text-[11px] text-gray-600 dark:text-gray-300">
              点击选区旁边出现的 LexiLens 按钮（或通过浏览器侧边栏打开 LexiLens）。
            </li>
            <li className="text-[11px] text-gray-600 dark:text-gray-300">
              等待几秒钟，侧边栏会自动展开，展示针对这次阅读场景的解释。
            </li>
          </ol>

          <div className="mt-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-white/60 dark:bg-gray-900/40 px-3 py-2">
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              TODO: 截图占位 — 放一张「网页选中单词 + 弹出 LexiLens 按钮」的动图或截图。
            </p>
          </div>
        </section>

        {/* Layers overview */}
        <section className="glass glass-border rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center">
              <Layers className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                四层解释如何帮你？
              </h2>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                每次查词，LexiLens 会按层次组织信息，你可以根据需要选择看多深。
              </p>
            </div>
          </div>

          <ul className="mt-1 space-y-1.5">
            <li className="text-[11px] text-gray-600 dark:text-gray-300">
              <span className="font-semibold text-gray-800 dark:text-gray-100">
                Layer 1：
              </span>{' '}
              用你熟悉的方式解释当前句子里的含义，避免逐词翻译。
            </li>
            <li className="text-[11px] text-gray-600 dark:text-gray-300">
              <span className="font-semibold text-gray-800 dark:text-gray-100">
                Layer 2：
              </span>{' '}
              用几条真实的延伸例子，展示这个词在类似场景下还能怎么用。
            </li>
            <li className="text-[11px] text-gray-600 dark:text-gray-300">
              <span className="font-semibold text-gray-800 dark:text-gray-100">
                Layer 3：
              </span>{' '}
              总结中国学习者常犯的错误，对比容易混淆的表达。
            </li>
            <li className="text-[11px] text-gray-600 dark:text-gray-300">
              <span className="font-semibold text-gray-800 dark:text-gray-100">
                Layer 4：
              </span>{' '}
              通过词汇地图和相关词，把这个词真正「放进」你的语义网络里。
            </li>
          </ul>
        </section>

        {/* Personalisation */}
        <section className="glass glass-border rounded-xl p-3 space-y-2">
          <h2 className="text-xs font-semibold text-gray-900 dark:text-gray-100">
            做好这三件事，教练会越来越懂你
          </h2>
          <ul className="mt-1 space-y-1.5">
            <li className="text-[11px] text-gray-600 dark:text-gray-300">
              在上方个人卡片里设置合适的英语等级，这会影响解释的深度和示例难度。
            </li>
            <li className="text-[11px] text-gray-600 dark:text-gray-300">
              多在自己真正关心的内容里查词，侧边栏下方的兴趣卡片会自动总结你的阅读主题。
            </li>
            <li className="text-[11px] text-gray-600 dark:text-gray-300">
              把想重点记住的词加入单词本，常回顾，可以配合 Layer 3 / Layer 4 的对比一起巩固。
            </li>
          </ul>
        </section>

        <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
          之后你可以随时通过顶部个人卡片右侧的「使用引导」按钮再次打开本页。
        </p>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onSkip}
          className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-4 py-1.5 text-[11px] font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
        >
          跳过并开始使用
        </button>
        <button
          type="button"
          onClick={onComplete}
          className="inline-flex items-center justify-center rounded-full border border-primary-500 bg-primary-500 px-4 py-1.5 text-[11px] font-medium text-white hover:bg-primary-600 dark:border-primary-400 dark:bg-primary-500 dark:hover:bg-primary-400"
        >
          我知道怎么用了，开始查词
        </button>
      </div>
    </div>
  );
}

