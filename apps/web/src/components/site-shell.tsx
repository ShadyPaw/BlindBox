'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Icon } from './icon';
import { art } from '../data/catalog';
import type { AuthUser } from '@box/types';
import { AuthForm } from './auth-form';
import { authRequest } from '../lib/auth-client';

type DialogState = {
  kind: 'welcome' | 'auth' | 'info' | 'support';
  title?: string;
  body?: string;
  mode?: 'login' | 'register';
} | null;
const SiteContext = createContext({
  login: () => {},
  info: (_title: string, _body?: string) => {},
  free: false,
});
export const useSite = () => useContext(SiteContext);
export const navigation = [
  { label: '首頁', href: '/', icon: 'home' },
  { label: '盲盒', href: '/boxes', icon: 'box' },
  { label: '免費福利', href: '/free-boxes', icon: 'gift' },
  { label: '排行榜', href: '/ranking', icon: 'chart' },
];
const legalGroups = [
  {
    title: '法律資訊',
    items: ['服務條款', '隱私政策', 'Cookie 政策', '免責聲明', '編輯政策'],
  },
  {
    title: '安全與合規',
    items: [
      '可驗證公平',
      'AML / 制裁 / 反欺詐政策',
      '付款與提現政策',
      '物品履約與配送政策',
      '道德準則',
    ],
  },
  { title: '支援', items: ['常見問題', '投訴政策'] },
];

export function Modal({
  title,
  children,
  onClose,
  className = '',
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    const overflow = document.body.style.overflow;
    el?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      el?.close();
      document.body.style.overflow = overflow;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      className={`modal ${className}`}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const r = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < r.left ||
            event.clientX > r.right ||
            event.clientY < r.top ||
            event.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <button
        className="modal-close"
        aria-label={className === 'welcome-modal' ? '關閉歡迎禮物' : '關閉'}
        onClick={onClose}
      >
        <Icon name="close" />
      </button>
      {children}
    </dialog>
  );
}

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>(null);
  const free = pathname.startsWith('/coin-boxes');
  const [menu, setMenu] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const authVersion = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => {
      const version = ++authVersion.current;
      fetch('/api/auth/me', { cache: 'no-store', signal: controller.signal })
        .then(async (response) => {
          if (response.ok) {
            const result = await response.json();
            if (version === authVersion.current) setUser(result.user);
          } else if (response.status === 401 && version === authVersion.current)
            setUser(null);
        })
        .catch(() => {});
    };
    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('box-auth-changed', refresh);
    return () => {
      controller.abort();
      window.removeEventListener('focus', refresh);
      window.removeEventListener('box-auth-changed', refresh);
    };
  }, [pathname]);
  useEffect(() => {
    if (new URL(window.location.href).searchParams.get('login') === '1') {
      sessionStorage.setItem('turbox-welcome-dismissed', '1');
      setDialog({ kind: 'auth' });
      return;
    }
    if (
      window.location.pathname === '/reset-password' ||
      window.location.pathname === '/account'
    )
      return;
    if (!sessionStorage.getItem('turbox-welcome-dismissed')) {
      const timer = setTimeout(
        () => setDialog((value) => value ?? { kind: 'welcome' }),
        600,
      );
      return () => clearTimeout(timer);
    }
  }, [pathname]);
  function close() {
    if (dialog?.kind === 'welcome')
      sessionStorage.setItem('turbox-welcome-dismissed', '1');
    setDialog(null);
  }
  function login() {
    if (user) {
      info('功能開發中', '您已登入。開箱、福利領取和背包將於後續階段開放。');
      return;
    }
    sessionStorage.setItem('turbox-welcome-dismissed', '1');
    setDialog({ kind: 'auth' });
    setMenu(false);
  }
  function info(
    title: string,
    body = '此頁面為前台預覽。完整內容與服務將在後端接入後提供。',
  ) {
    setDialog({ kind: 'info', title, body });
  }
  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await authRequest('logout', {});
      authVersion.current++;
      setUser(null);
      router.push('/');
      router.refresh();
    } catch (error) {
      info('登出失敗', error instanceof Error ? error.message : '請稍後重試');
    } finally {
      setLoggingOut(false);
    }
  }
  return (
    <SiteContext.Provider value={{ login, info, free }}>
      <header className="site-header">
        <Link
          href={free ? '/coin-boxes' : '/'}
          aria-label="TURBOX 首頁"
          className="brand"
        >
          <img src="/reference/4e12ca7237f7ca5a.png" alt="TURBOX" />
        </Link>
        <nav
          aria-label="主導覽"
          className={menu ? 'desktop-nav expanded' : 'desktop-nav'}
        >
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={
                free && (item.href === '/' || item.href === '/boxes')
                  ? '/coin-boxes'
                  : item.href
              }
              onClick={() => setMenu(false)}
              className={
                (
                  item.href === '/'
                    ? pathname === '/'
                    : pathname.startsWith(item.href)
                )
                  ? 'active'
                  : ''
              }
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          ))}
          <button onClick={login}>
            <Icon name="diamond" />
            空投
          </button>
        </nav>
        <div className="header-actions">
          <div className={`mode-switch ${free ? 'free-mode' : ''}`}>
            <button
              className={!free ? 'selected' : ''}
              aria-pressed={!free}
              onClick={() => router.push('/')}
            >
              消費
            </button>
            <button
              className={free ? 'selected' : ''}
              aria-pressed={free}
              onClick={() => router.push('/coin-boxes')}
            >
              免費
            </button>
          </div>
          {user ? (
            <>
              <Link className="secondary account-link" href="/account">
                我的帳戶
              </Link>
              <button
                className="primary"
                disabled={loggingOut}
                onClick={logout}
              >
                {loggingOut ? '登出中…' : '登出'}
              </button>
            </>
          ) : (
            <>
              <button className="secondary login-button" onClick={login}>
                登入
              </button>
              <button
                className="primary register-button"
                onClick={() => {
                  sessionStorage.setItem('turbox-welcome-dismissed', '1');
                  setDialog({ kind: 'auth', mode: 'register' });
                }}
              >
                註冊
              </button>
            </>
          )}
          <button
            className="menu-button"
            aria-label="展開選單"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            <Icon name="menu" />
          </button>
        </div>
      </header>
      <main>{children}</main>
      <footer className="site-footer">
        <div className="footer-top">
          <div className="company">
            <img
              className="footer-logo"
              src="/reference/4e12ca7237f7ca5a.png"
              alt="TURBOX"
            />
            <p>Turbox 由 WanderBox LLC 營運</p>
            <p>
              1908 Thomes Ave Ste 12018
              <br />
              Cheyenne, WY 82001
            </p>
            <p>
              註冊編號：2026-001906907
              <br />
              官方網站：www.turbox.gg
            </p>
          </div>
          <div className="footer-column">
            <h3>功能</h3>
            {navigation.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </div>
          {legalGroups.map((group) => (
            <div className="footer-column" key={group.title}>
              <h3>{group.title}</h3>
              {group.items.map((item) => (
                <button key={item} onClick={() => info(item)}>
                  {item}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="footer-middle">
          <div className="socials">
            {[
              { label: '𝕏', name: 'X', href: 'https://x.com/xuan181126' },
              {
                label: '◎',
                name: 'Instagram',
                href: 'https://www.instagram.com/turboxgg_/',
              },
              {
                label: '♪',
                name: 'TikTok',
                href: 'https://www.tiktok.com/@turboxgg',
              },
              {
                label: '▶',
                name: 'YouTube',
                href: 'https://www.youtube.com/@TurBox_gg',
              },
              {
                label: 'f',
                name: 'Facebook',
                href: 'https://www.facebook.com/share/1KoE9D56y8/?mibextid=wwXIfr',
              },
            ].map(({ label, name, href }) => (
              <a
                key={label}
                aria-label={name}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {label}
              </a>
            ))}
          </div>
          <div className="payments">
            <span>₮</span>
            <b>VISA</b>
            <span className="mastercard">●●</span>
            <b>Apple Pay</b>
            <b>G Pay</b>
          </div>
          <button
            className="language"
            onClick={() =>
              info(
                '語言',
                '目前預覽版本使用繁體中文。其他語言將在前台驗收後接入。',
              )
            }
          >
            繁體中文⌄
          </button>
        </div>
        <div className="footer-bottom">
          <p>
            <span className="age">18+</span>
            使用本網站即表示您聲明已達法定年齡並符合所在地法規。請理性娛樂。
          </p>
          <p>
            © 2026 TURBOX. 版權所有。 <span>v2.0.1.005</span>
          </p>
        </div>
      </footer>
      <div className="floating-tools">
        <button
          className="support-button"
          aria-label="聯絡客服"
          onClick={() => setDialog({ kind: 'support' })}
        >
          <Icon name="chat" size={25} />
        </button>
        <button
          className="gift-button"
          onClick={() => setDialog({ kind: 'welcome' })}
        >
          <img src={art(8)} alt="" />
          <span>3 個優惠</span>
        </button>
      </div>
      <nav className="mobile-nav" aria-label="手機導覽">
        <Link href="/">
          <Icon name="home" />
          首頁
        </Link>
        <Link href="/boxes">
          <Icon name="box" />
          盲盒
        </Link>
        <button onClick={login}>
          <Icon name="gift" />
          背包
        </button>
        <button onClick={() => (user ? router.push('/account') : login())}>
          <Icon name="user" />
          個人中心
        </button>
      </nav>
      {dialog && (
        <Modal
          title={
            dialog.kind === 'auth'
              ? '歡迎來到 Turbox'
              : dialog.kind === 'welcome'
                ? '领取你的 免费盒子'
                : (dialog.title ?? '聯絡客服')
          }
          onClose={close}
          className={
            dialog.kind === 'welcome'
              ? 'welcome-modal'
              : dialog.kind === 'auth'
                ? 'auth-modal'
                : ''
          }
        >
          {dialog.kind === 'welcome' ? (
            <>
              <button
                className="gift-help"
                aria-label="查看活動說明"
                onClick={() =>
                  info(
                    '歡迎禮物',
                    '選擇喜愛的盲盒類型，登入後查看新用戶福利。前台預覽不發放真實獎品。',
                  )
                }
              >
                ?
              </button>
              <span className="gift-pill">★ 歡迎禮物</span>
              <h2>
                领取你的 <strong>免费盒子</strong>
              </h2>
              <p>免費獲得 1 個神秘盲盒。</p>
              <div className="gift-choices">
                {[9, 10].map((n, i) => (
                  <button key={n} onClick={login}>
                    <img src={art(n)} alt={i ? '卡牌' : '数码'} />
                  </button>
                ))}
              </div>
              <p className="gift-caption">點擊其中一個，揭曉你的免費盲盒</p>
              <img
                className="gift-logo"
                src="/reference/4e12ca7237f7ca5a.png"
                alt="TURBOX"
              />
            </>
          ) : dialog.kind === 'auth' ? (
            <AuthForm
              initialMode={dialog.mode ?? 'login'}
              onNavigate={close}
              onSuccess={(account) => {
                authVersion.current++;
                setUser(account);
                close();
                router.refresh();
              }}
            />
          ) : dialog.kind === 'support' ? (
            <>
              <h2>聯絡客服</h2>
              <p className="muted">歡迎來到 TURBOX，有什麼可以幫助您？</p>
              {['如何開啟盲盒？', '如何領取免費福利？', '付款與配送'].map(
                (q) => (
                  <details className="faq" key={q}>
                    <summary>{q}</summary>
                    <p>
                      {q === '如何開啟盲盒？'
                        ? '選擇盲盒，查看內容與公開概率，再選擇開箱數量。'
                        : q === '如何領取免費福利？'
                          ? '免費福利依會員等級解鎖，登入後可查看領取資格。'
                          : '目前為前台演示，付款、提現及配送尚未開放。'}
                    </p>
                  </details>
                ),
              )}
              <button
                className="primary wide"
                onClick={() =>
                  info('客服服務', '客服訊息服務尚未連線，沒有訊息被送出。')
                }
              >
                開始對話
              </button>
            </>
          ) : (
            <>
              <h2>{dialog.title}</h2>
              <p className="info-body">{dialog.body}</p>
              <button className="primary wide" onClick={close}>
                我知道了
              </button>
            </>
          )}
        </Modal>
      )}
    </SiteContext.Provider>
  );
}
