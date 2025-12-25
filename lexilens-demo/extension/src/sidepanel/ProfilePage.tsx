import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Star, Trash2 } from 'lucide-react';
import InterestCard from '../components/InterestCard';
import { getLevelConfig, type UserProfile } from './hooks/useUserProfile';
import type { UseInterestsResult } from './hooks/useInterests';
import type { WordbookEntry } from '../shared/types';

const PAGE_SIZE = 10;

interface ProfileWordbookApi {
  entries: WordbookEntry[];
  loading: boolean;
  updateStage: (id: string, stage: WordbookEntry['stage']) => void;
  toggleFavoriteByWord: (word: string) => void;
  deleteEntry: (id: string) => void;
}

interface ProfilePageProps {
  profile: UserProfile;
  onUpdateProfile: (partial: Partial<UserProfile>) => void;
  onBack: () => void;
  onLevelClick: () => void;
  interests: UseInterestsResult;
  wordbook: ProfileWordbookApi;
  onOpenWordbookEntry: (id: string) => void;
  activeEntryId?: string | null;
}

export default function ProfilePage({
  profile,
  onUpdateProfile,
  onBack,
  onLevelClick,
  interests,
   wordbook,
   onOpenWordbookEntry,
   activeEntryId,
}: ProfilePageProps) {
  const [nicknameInput, setNicknameInput] = useState(profile.nickname);
  const [avatarInput, setAvatarInput] = useState(profile.avatarUrl ?? '');
  const [page, setPage] = useState(0);

  const levelConfig = getLevelConfig(profile.englishLevel);

  useEffect(() => {
    setNicknameInput(profile.nickname);
    setAvatarInput(profile.avatarUrl ?? '');
  }, [profile.nickname, profile.avatarUrl]);

  const handleNicknameBlur = () => {
    const trimmed = nicknameInput.trim();
    if (!trimmed || trimmed === profile.nickname) return;
    onUpdateProfile({ nickname: trimmed });
  };

  const handleAvatarBlur = () => {
    const trimmed = avatarInput.trim();
    onUpdateProfile({ avatarUrl: trimmed || undefined });
  };

  // Keep pagination stable when the wordbook changes, but clamp the
  // current page index so it never points past the end.
  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil(wordbook.entries.length / PAGE_SIZE),
    );
    setPage((prev) => {
      if (!Number.isFinite(prev) || prev < 0) return 0;
      return prev >= totalPages ? totalPages - 1 : prev;
    });
  }, [wordbook.entries.length]);

  const sortedEntries = useMemo(() => {
    if (!wordbook.entries.length) return [];

    const getCreatedTime = (entry: WordbookEntry): number =>
      entry.createdAt ?? entry.lastReviewedAt ?? 0;

    return [...wordbook.entries].sort((a, b) => {
      const favA = !!a.isFavorite;
      const favB = !!b.isFavorite;
      if (favA !== favB) return favA ? -1 : 1;

      const aCreated = getCreatedTime(a);
      const bCreated = getCreatedTime(b);
      return bCreated - aCreated;
    });
  }, [wordbook.entries]);

  const totalPages = Math.max(
    1,
    Math.ceil(sortedEntries.length / PAGE_SIZE),
  );

  const pageEntries = sortedEntries.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE,
  );

  return (
    <div className="h-full w-full px-6 pb-6 pt-2 flex flex-col">
      <header className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center h-8 w-8 rounded-full bg-white/70 dark:bg-gray-800/80 shadow-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="返回词汇教练"
        >
          <ArrowLeft className="h-4 w-4 text-gray-700 dark:text-gray-200" />
        </button>
        <div className="flex flex-col">
          <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            个人信息 & 兴趣
          </h1>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            管理头像、昵称、英语等级，以及 LexiLens 为你总结的兴趣内容和单词本。
          </p>
        </div>
      </header>

      <div className="space-y-4 overflow-y-auto pr-1">
        {/* Basic profile */}
        <section className="glass glass-border rounded-xl p-4 space-y-3">
          <h2 className="text-xs font-semibold text-gray-800 dark:text-gray-100">
            基本信息
          </h2>
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="h-14 w-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-base font-semibold text-white shadow-md overflow-hidden">
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.nickname}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  (profile.nickname?.trim().charAt(0).toUpperCase() || 'L')
                )}
              </div>
            </div>
            <div className="flex-1 space-y-2 min-w-0">
              <div>
                <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">
                  昵称
                </label>
                <input
                  type="text"
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  onBlur={handleNicknameBlur}
                  placeholder="给自己起一个学习昵称"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-xs text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">
                  头像链接（可选）
                </label>
                <input
                  type="url"
                  value={avatarInput}
                  onChange={(e) => setAvatarInput(e.target.value)}
                  onBlur={handleAvatarBlur}
                  placeholder="粘贴一张适合作为头像的图片链接"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-xs text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                英语等级
              </p>
              <div className="mt-0.5 flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${levelConfig.badgeClassName}`}
                >
                  {levelConfig.label}
                </span>
                <span className="text-xs text-gray-600 dark:text-gray-300">
                  {levelConfig.ability}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                推荐：{levelConfig.recommendation}
              </p>
            </div>
            <button
              type="button"
              onClick={onLevelClick}
              className="flex-shrink-0 inline-flex items-center justify-center rounded-full border border-primary-500 px-3 py-1.5 text-[11px] font-medium text-primary-600 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/40 transition-colors"
            >
              调整等级
            </button>
          </div>
        </section>

        {/* Interests */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-gray-800 dark:text-gray-100">
              兴趣内容
            </h2>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {interests.topics.length > 0
                ? `当前 ${interests.topics.length} 个兴趣方向`
                : '还没有明确的兴趣方向'}
            </p>
          </div>
          {interests.loading ? (
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              正在加载你的兴趣内容……
            </p>
          ) : interests.topics.length === 0 ? (
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              还没有个性化兴趣，可以多用几次 LexiLens，我会根据你最近阅读和查词的页面，帮你总结几个兴趣方向。
            </p>
          ) : (
            <div className="space-y-3">
              {interests.topics.map((topic) => (
                <InterestCard
                  key={topic.id}
                  topic={topic}
                  onRemoveLink={(url) => interests.removeLink(topic.id, url)}
                  onDeleteTopic={() => interests.deleteTopic(topic.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Wordbook */}
        <section className="space-y-2 pb-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-gray-800 dark:text-gray-100">
              单词本
            </h2>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              掌握进度分为 1–5 阶段，颜色越深表示越熟练。
            </p>
          </div>

          {wordbook.loading ? (
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              正在加载单词本……
            </p>
          ) : wordbook.entries.length === 0 ? (
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              目前单词本还是空的，后续可以把想重点记住的词加入这里。
            </p>
          ) : (
            <div className="space-y-2">
              {pageEntries.map((entry) => {
                const subtitle =
                  entry.translation ??
                  entry.latestSnapshot?.analysis?.layer1?.definition;
                const contextSnippet =
                  entry.example ?? entry.latestSnapshot?.request.context;
                const isActive = activeEntryId === entry.id;

                return (
                <div
                  key={entry.id}
                  onClick={() => onOpenWordbookEntry(entry.id)}
                  className={`glass glass-border rounded-xl px-3 py-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                    isActive
                      ? 'border-primary-400 bg-primary-50/70 dark:bg-primary-900/20 dark:border-primary-500'
                      : 'hover:border-primary-300/90 dark:hover:border-primary-400/90'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                      {entry.word}
                    </p>
                    {subtitle && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        {subtitle}
                      </p>
                    )}
                    {contextSnippet && contextSnippet !== subtitle && (
                      <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2">
                        {contextSnippet}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((stage) => (
                        <button
                          key={stage}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            wordbook.updateStage(
                              entry.id,
                              stage as WordbookEntry['stage'],
                            );
                          }}
                          className={`h-2 w-4 rounded-full transition-colors ${
                            stage <= entry.stage
                              ? 'bg-primary-500'
                              : 'bg-gray-200 dark:bg-gray-700'
                          }`}
                          aria-label={`将 ${entry.word} 调整到掌握阶段 ${stage}`}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">
                        当前阶段：{entry.stage} / 5
                      </span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          wordbook.toggleFavoriteByWord(entry.word);
                        }}
                        className="inline-flex items-center justify-center h-6 w-6 rounded-full hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                        aria-label={
                          entry.isFavorite ? '移除精选单词' : '标记为精选单词'
                        }
                      >
                        <Star
                          className={`h-3.5 w-3.5 ${
                            entry.isFavorite
                              ? 'text-yellow-500'
                              : 'text-gray-300 dark:text-gray-600'
                          }`}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          const confirmed = window.confirm(
                            '确定删除这个单词条目吗？此操作不可撤销。',
                          );
                          if (!confirmed) return;
                          wordbook.deleteEntry(entry.id);
                        }}
                        className="inline-flex items-center justify-center h-6 w-6 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20"
                        aria-label="删除这个单词条目"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              );})}

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      setPage((prev) => (prev > 0 ? prev - 1 : prev))
                    }
                    disabled={page === 0}
                    className="px-2 py-1 text-[11px] rounded-full border border-gray-200 bg-white text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                  >
                    上一页
                  </button>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">
                    第 {page + 1} / {totalPages} 页
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPage((prev) =>
                        prev < totalPages - 1 ? prev + 1 : prev,
                      )
                    }
                    disabled={page >= totalPages - 1}
                    className="px-2 py-1 text-[11px] rounded-full border border-gray-200 bg-white text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                  >
                    下一页
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
