import { ExternalLink, Trash2 } from 'lucide-react';
import type { InterestTopic, InterestLink } from '../shared/types';

interface InterestCardProps {
  topic: InterestTopic;
  onRemoveLink: (url: string) => void;
  onDeleteTopic: () => void;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  if (Number.isNaN(diffMs) || diffMs < 0) return '';

  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 60) return '刚刚';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} 小时前`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} 天前`;

  const date = new Date(timestamp);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month} 月 ${day} 日`;
}

function getHost(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function openLink(link: InterestLink) {
  try {
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url: link.url });
    } else {
      window.open(link.url, '_blank', 'noopener,noreferrer');
    }
  } catch {
    // ignore
  }
}

export default function InterestCard({
  topic,
  onRemoveLink,
  onDeleteTopic,
}: InterestCardProps) {
  const hasLinks = topic.links && topic.links.length > 0;

  const handleDeleteTopic = () => {
    const ok = window.confirm('确定要删除这个兴趣吗？之后的解释中将不再提到它。');
    if (!ok) return;
    onDeleteTopic();
  };

  return (
    <section className="glass glass-border rounded-xl p-3.5 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="inline-flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {topic.title}
            </h3>
            <span className="inline-flex items-center rounded-full bg-primary-50 dark:bg-primary-900/40 px-2 py-0.5 text-[10px] font-medium text-primary-700 dark:text-primary-200">
              兴趣领域
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
            {topic.summary}
          </p>
        </div>

        <button
          type="button"
          onClick={handleDeleteTopic}
          className="flex-shrink-0 p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/40 transition-colors"
          aria-label="删除这个兴趣"
          title="删除这个兴趣"
        >
          <Trash2 className="h-3.5 w-3.5 text-red-500" />
        </button>
      </div>

      <div className="border-t border-gray-100 dark:border-gray-800 pt-2">
        <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1.5">
          最近和这个兴趣相关的内容
        </p>
        {hasLinks ? (
          <ul className="space-y-1.5">
            {topic.links.map((link) => (
              <li
                key={link.url}
                className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 dark:border-gray-800 px-2 py-1.5"
              >
                <button
                  type="button"
                  onClick={() => openLink(link)}
                  className="flex items-center gap-2 text-left flex-1 group"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-gray-800 dark:text-gray-100 truncate">
                      {link.title || getHost(link.url)}
                    </span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                      {getHost(link.url)} · {formatRelativeTime(link.lastUsedAt)}
                    </span>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-gray-400 group-hover:text-primary-500" />
                </button>

                <button
                  type="button"
                  onClick={() => onRemoveLink(link.url)}
                  className="flex-shrink-0 text-[11px] text-gray-400 hover:text-red-500 transition-colors"
                >
                  删除
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            还没有和这个兴趣相关的具体记录，之后你使用 LexiLens 时我会慢慢帮你补充。
          </p>
        )}
      </div>
    </section>
  );
}

