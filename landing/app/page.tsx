'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';

type WaitlistState = 'idle' | 'submitting' | 'success' | 'error';

export default function LandingPage() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<WaitlistState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state === 'submitting') return;

    const trimmed = email.trim();
    if (!trimmed) {
      setErrorMessage('请输入有效的邮箱地址');
      setState('error');
      return;
    }

    setState('submitting');
    setErrorMessage(null);

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: trimmed, source: 'landing' })
      });

      if (response.status === 201) {
        setState('success');
      } else {
        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        if (data?.error === 'invalid_email') {
          setErrorMessage('邮箱格式不正确，请重新检查');
        } else {
          setErrorMessage('提交失败，请稍后重试');
        }
        setState('error');
      }
    } catch (error) {
      console.error('Failed to submit waitlist', error);
      setErrorMessage('网络异常，请稍后重试');
      setState('error');
    }
  };

  return (
    <main className="ll-main">
      <section className="ll-hero" id="top">
        <div className="ll-container">
          <h1 className="ll-hero-title">LexiLens</h1>
          <p className="ll-hero-subtitle">
            让英语学习回到真实阅读和写作场景的「即时教练」。
          </p>
          <div className="ll-hero-actions">
            <a href="#waitlist" className="ll-button-primary">
              加入候补名单（Join Waitlist）
            </a>
            <Link href="/judge" className="ll-button-secondary">
              好未来 Hackathon 评委入口
            </Link>
          </div>
          <p className="ll-hero-note">
            Chrome 侧边栏插件 + 云端服务，让你在浏览网页时顺手搞定词汇、表达和写作反馈。
          </p>
          <p className="ll-hero-note">
            TAL AI HACKATHON 参赛作品 · 团队名称：Bazinga · 成员：李想、姬弘飞（外部）
          </p>
          <div className="ll-hero-placeholder">
            {/* TODO: Screenshot – hero illustration / side-panel preview */}
          </div>
        </div>
      </section>

      <section className="ll-section">
        <div className="ll-container">
          <h2 className="ll-section-title">核心功能亮点</h2>
          <div className="ll-grid-3">
            <div className="ll-card">
              <h3>分层讲解</h3>
              <p>
                通过多层解释（使用模式 / 真实例句 / 常见错误 / 词汇地图），帮你把「看不懂的词」变成「能用出来的表达」。
              </p>
              <div className="ll-card-placeholder">
                {/* TODO: Screenshot – analysis layers view */}
              </div>
            </div>
            <div className="ll-card">
              <h3>个性化学习轨迹</h3>
              <p>
                自动记录你查过的词、感兴趣的主题和语境，形成个人词本和学习历史，持续给出更贴近你的解释。
              </p>
              <div className="ll-card-placeholder">
                {/* TODO: Screenshot – wordbook / history view */}
              </div>
            </div>
            <div className="ll-card">
              <h3>零打扰侧边栏体验</h3>
              <p>
                不打断你正在浏览的网页，只在需要时唤出侧边栏，快速看完、记住、关闭即可。
              </p>
              <div className="ll-card-placeholder">
                {/* TODO: Screenshot – side panel open on article */}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="ll-section ll-section-alt">
        <div className="ll-container">
          <h2 className="ll-section-title">如何使用 LexiLens</h2>
          <ol className="ll-steps">
            <li>
              在 Chrome 地址栏输入 <code>chrome://extensions</code>，打开扩展管理页面并开启右上角「开发者模式」。
            </li>
            <li>
              将我们提供的 LexiLens 安装包（CRX 文件）拖拽到该页面，按浏览器提示完成安装。
            </li>
            <li>安装完成后，在任意英文网页中选中一个词或短语。</li>
            <li>点击浮动按钮或浏览器入口打开 LexiLens 侧边栏。</li>
            <li>阅读多层解释、保存生词，按照提示完成一次完整练习。</li>
          </ol>
        </div>
      </section>

      <section className="ll-section" id="waitlist">
        <div className="ll-container ll-waitlist">
          <div>
            <h2 className="ll-section-title">加入候补名单（Join Waitlist）</h2>
            <p className="ll-section-intro">
              第一时间获取正式版安装包和使用指南，我们也会优先邀请你参与后续内测。
            </p>
          </div>

          <form className="ll-form" onSubmit={handleSubmit}>
            <label className="ll-label" htmlFor="email">
              邮箱地址
            </label>
            <div className="ll-form-row">
              <input
                id="email"
                type="email"
                className="ll-input"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={state === 'submitting' || state === 'success'}
              />
              <button
                type="submit"
                className="ll-button-primary"
                disabled={state === 'submitting' || state === 'success'}
              >
                {state === 'submitting' ? '提交中…' : '加入候补名单'}
              </button>
            </div>
            {state === 'success' && (
              <p className="ll-message ll-message-success">
                已收到你的邮箱，我们会上线后第一时间通知你。
              </p>
            )}
            {state === 'error' && errorMessage && (
              <p className="ll-message ll-message-error">{errorMessage}</p>
            )}
          </form>

          <p className="ll-waitlist-note">
            提交邮箱即表示你同意我们在产品更新和内测邀请时联系你。我们不会把你的信息分享给第三方。
          </p>
        </div>
      </section>

      <section className="ll-section ll-section-small">
        <div className="ll-container ll-judge-cta">
          <p>如果你是好未来 Hackathon 的评委，可以从这里进入评审版本下载入口。</p>
          <Link href="/judge" className="ll-button-secondary">
            前往 评委入口
          </Link>
        </div>
      </section>
    </main>
  );
}
