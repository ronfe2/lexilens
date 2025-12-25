'use client';

import { FormEvent, useState } from 'react';

type JudgeState = 'idle' | 'submitting' | 'success' | 'error';

interface JudgeSuccessPayload {
  ok: true;
  downloadUrl?: string | null;
}

interface JudgeErrorPayload {
  ok: false;
}

export default function JudgePage() {
  const [code, setCode] = useState('');
  const [state, setState] = useState<JudgeState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state === 'submitting') return;

    const trimmed = code.trim();
    if (!trimmed) {
      setErrorMessage('请输入主办方提供的访问口令');
      setState('error');
      return;
    }

    setState('submitting');
    setErrorMessage(null);

    try {
      const response = await fetch('/api/judge-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code: trimmed })
      });

      if (response.ok) {
        const data = (await response.json()) as JudgeSuccessPayload;
        setDownloadUrl(data.downloadUrl ?? null);
        setState('success');
      } else {
        const _data = (await response.json().catch(() => null)) as
          | JudgeErrorPayload
          | null;
        console.warn('Judge login failed', _data);
        setErrorMessage('访问口令不正确，请确认后再试。');
        setState('error');
      }
    } catch (error) {
      console.error('Failed to call judge-login', error);
      setErrorMessage('网络异常，请稍后重试。');
      setState('error');
    }
  };

  return (
    <main className="ll-main">
      <section className="ll-section">
        <div className="ll-container ll-judge">
          <h1 className="ll-section-title">好未来 Hackathon 评委入口</h1>
          <p className="ll-section-intro">
            这里提供 LexiLens 正式版评审包的下载与安装说明。请使用主办方提供的访问口令进入，
            验证通过后可直接下载 Chrome 扩展 dist 压缩包（ZIP）及相关使用说明。
          </p>

          <form className="ll-form ll-form-judge" onSubmit={handleSubmit}>
            <label className="ll-label" htmlFor="judge-code">
              访问口令
            </label>
            <div className="ll-form-row">
              <input
                id="judge-code"
                type="password"
                className="ll-input"
                placeholder="请输入评委专用 code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                disabled={state === 'submitting' || state === 'success'}
              />
              <button
                type="submit"
                className="ll-button-primary"
                disabled={state === 'submitting' || state === 'success'}
              >
                {state === 'submitting' ? '验证中…' : '进入评委专区'}
              </button>
            </div>
            {state === 'error' && errorMessage && (
              <p className="ll-message ll-message-error">{errorMessage}</p>
            )}
          </form>

          {state === 'success' && (
            <div className="ll-judge-panel">
              <h2>评审包下载与安装说明</h2>
              <p>
                感谢你参与评审。下面是 LexiLens 正式版的安装方式示意，具体链接和截图会由我们在提交前补充。
              </p>

              {downloadUrl ? (
                <p className="ll-judge-download">
                  正式版 Chrome 扩展 dist 压缩包（ZIP）下载链接：
                  <a href={downloadUrl} target="_blank" rel="noreferrer">
                    点击下载
                  </a>
                </p>
              ) : (
                <p className="ll-judge-download">
                  <em>
                    TODO: 在部署时填入 FORMAL_PACKAGE_URL，用于提供真实下载链接。
                  </em>
                </p>
              )}

              <ol className="ll-steps">
                <li>
                  下载正式版 Chrome 扩展 dist 压缩包（例如：lexilens-formal-dist.zip）。
                </li>
                <li>
                  在本地解压 ZIP，确认其中包含带有 <code>manifest.json</code> 的{' '}
                  <code>dist/</code> 目录；在 Chrome 打开 <code>chrome://extensions</code>，
                  开启「开发者模式」，点击「加载已解压的扩展程序」，并选择该目录完成安装。
                </li>
                <li>按照 README / docs/DEPLOYMENT.md 中的步骤部署后端（Render 或本地）。</li>
                <li>在 Chrome 中打开任意英文页面，确认扩展已连接云端服务并可以正常查词。</li>
                <li>
                  进入任意英文页面，按照「评委体验脚本」完成一次完整的阅读 + 词汇学习流程。
                </li>
              </ol>

              <div className="ll-card-placeholder">
                {/* TODO: Screenshot – judge-only download panel / onboarding view */}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
