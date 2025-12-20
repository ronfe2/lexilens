import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import InterestCard from '../components/InterestCard';
import { getLevelConfig, type UserProfile } from './hooks/useUserProfile';
import type { UseInterestsResult } from './hooks/useInterests';
import { useWordbook } from './hooks/useWordbook';

interface ProfilePageProps {
  profile: UserProfile;
  onUpdateProfile: (partial: Partial<UserProfile>) => void;
  onBack: () => void;
  onLevelClick: () => void;
  interests: UseInterestsResult;
}

export default function ProfilePage({
  profile,
  onUpdateProfile,
  onBack,
  onLevelClick,
  interests,
}: ProfilePageProps) {
  const [nicknameInput, setNicknameInput] = useState(profile.nickname);
  const [avatarInput, setAvatarInput] = useState(profile.avatarUrl ?? '');

  const levelConfig = getLevelConfig(profile.englishLevel);
  const wordbook = useWordbook();

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
              <p className="mt-0.5 text-xs text-gray-800 dark:text-gray-100">
                {levelConfig.label}{' '}
                <span className="text-gray-500 dark:text-gray-400">
                  · {levelConfig.ability}
                </span>
              </p>
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
              {wordbook.entries.map((entry) => (
                <div
                  key={entry.id}
                  className="glass glass-border rounded-xl px-3 py-2.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                      {entry.word}
                    </p>
                    {entry.translation && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        {entry.translation}
                      </p>
                    )}
                    {entry.example && (
                      <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2">
                        {entry.example}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((stage) => (
                        <button
                          key={stage}
                          type="button"
                          onClick={() =>
                            wordbook.updateStage(entry.id, stage as 1 | 2 | 3 | 4 | 5)
                          }
                          className={`h-2 w-4 rounded-full transition-colors ${
                            stage <= entry.stage
                              ? 'bg-primary-500'
                              : 'bg-gray-200 dark:bg-gray-700'
                          }`}
                          aria-label={`将 ${entry.word} 调整到掌握阶段 ${stage}`}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">
                      当前阶段：{entry.stage} / 5
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
