import { Button } from '@douyinfe/semi-ui-19'
import { IconShieldStroked, IconAlignVBotStroked, IconGridStroked } from '@douyinfe/semi-icons'
import { useNavigate } from 'react-router-dom'
import { useCasdoor } from '@hquant/casdoor/client/react'
import klineImg from '@/assets/images/kline.png'
import dslCodeImg from '@/assets/images/dsl-code.png'

export default function Home() {
  const navigate = useNavigate()
  const { isAuthenticated } = useCasdoor()

  const handleGetStarted = () => {
    if (isAuthenticated) {
      navigate('/dashboard')
    } else {
      navigate('/login')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)', color: 'var(--text-0)' }}>
      {/* Header */}
      <header style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        padding: '16px 48px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(10, 10, 15, 0.8)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.5px' }}>
          <span style={{ color: '#6366f1' }}>H</span>Quant
        </div>
        <Button theme="solid" onClick={handleGetStarted}>
          {isAuthenticated ? '进入控制台' : '开始使用'}
        </Button>
      </header>

      {/* Hero — kline.png 做背景 */}
      <section style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {/* 背景图 */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${klineImg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.18,
          filter: 'blur(2px)',
        }} />
        {/* 渐变遮罩 */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, var(--bg-0) 0%, transparent 30%, transparent 70%, var(--bg-0) 100%)',
        }} />

        <div style={{
          position: 'relative',
          zIndex: 1,
          textAlign: 'center',
          maxWidth: '800px',
          padding: '0 32px',
        }}>
          <h1 style={{
            fontSize: '60px',
            fontWeight: 800,
            lineHeight: 1.15,
            marginBottom: '24px',
            letterSpacing: '-1px',
          }}>
            智能量化
            <br />
            <span style={{ color: '#6366f1' }}>交易平台</span>
          </h1>
          <p style={{
            fontSize: '18px',
            color: 'var(--text-2)',
            lineHeight: 1.7,
            maxWidth: '560px',
            margin: '0 auto 40px',
          }}>
            专业的量化交易解决方案，支持多交易所接入、DSL 策略编写、实时行情监控与风险管理
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            <Button
              size="large"
              theme="solid"
              onClick={handleGetStarted}
              style={{ padding: '12px 40px', fontSize: '16px' }}
            >
              立即开始
            </Button>
            <Button
              size="large"
              theme="borderless"
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              style={{ padding: '12px 32px', fontSize: '16px', color: 'var(--text-1)' }}
            >
              了解更多
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{
        padding: '100px 48px',
        background: 'var(--bg-1)',
        borderTop: '1px solid var(--border-color)',
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '36px', fontWeight: 700, textAlign: 'center', marginBottom: '16px' }}>
            核心能力
          </h2>
          <p style={{ textAlign: 'center', color: 'var(--text-2)', marginBottom: '64px', fontSize: '16px' }}>
            从策略编写到实盘执行，覆盖量化交易全流程
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '28px',
          }}>
            <FeatureCard
              icon={<IconGridStroked size="extra-large" />}
              title="策略回测"
              description="高性能 Rust 回测引擎，支持多种技术指标与自定义 DSL 策略编写"
            />
            <FeatureCard
              icon={<IconAlignVBotStroked size="extra-large" />}
              title="实时交易"
              description="毫秒级行情推送，支持 Binance、OKX、Bybit 等主流交易所"
            />
            <FeatureCard
              icon={<IconShieldStroked size="extra-large" />}
              title="风险控制"
              description="多层风控引擎，自动止损止盈，仓位管理与资金安全保障"
            />
          </div>
        </div>
      </section>

      {/* Showcase 1 — 交易界面 */}
      <section style={{
        padding: '100px 48px',
        background: 'var(--bg-0)',
      }}>
        <div style={{
          maxWidth: '1100px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '64px',
          alignItems: 'center',
        }}>
          <div>
            <div style={{
              fontSize: '13px',
              fontWeight: 600,
              color: '#6366f1',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '12px',
            }}>
              实时行情
            </div>
            <h3 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '16px', lineHeight: 1.3 }}>
              专业交易视图
            </h3>
            <p style={{ color: 'var(--text-2)', lineHeight: 1.8, fontSize: '15px', marginBottom: '24px' }}>
              内置专业 K 线图表，支持多周期切换、技术指标叠加，配合实时行情数据与一键下单面板，让交易决策更高效。
            </p>
            <ul style={{
              listStyle: 'none',
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              color: 'var(--text-2)',
              fontSize: '14px',
            }}>
              {['多周期 K 线图 (15m / 4H / 1D)', '均线、布林带等技术指标', '现货 & 合约下单', '实时成交量监控'].map((item) => (
                <li key={item} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#10b981', fontSize: '16px' }}>✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div style={{
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid var(--border-color)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <img
              src={klineImg}
              alt="交易界面"
              style={{ width: '100%', display: 'block' }}
            />
          </div>
        </div>
      </section>

      {/* Showcase 2 — DSL 策略 (图文反向排列) */}
      <section style={{
        padding: '100px 48px',
        background: 'var(--bg-1)',
        borderTop: '1px solid var(--border-color)',
      }}>
        <div style={{
          maxWidth: '1100px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '64px',
          alignItems: 'center',
        }}>
          <div style={{
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid var(--border-color)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <img
              src={dslCodeImg}
              alt="DSL 策略代码"
              style={{ width: '100%', display: 'block' }}
            />
          </div>
          <div>
            <div style={{
              fontSize: '13px',
              fontWeight: 600,
              color: '#6366f1',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '12px',
            }}>
              策略引擎
            </div>
            <h3 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '16px', lineHeight: 1.3 }}>
              DSL 策略编写
            </h3>
            <p style={{ color: 'var(--text-2)', lineHeight: 1.8, fontSize: '15px', marginBottom: '24px' }}>
              自研 DSL 语法，用最简洁的代码表达交易逻辑。内置 RSI、布林带等常用指标函数，几行代码即可定义完整的交易策略。
            </p>
            <ul style={{
              listStyle: 'none',
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              color: 'var(--text-2)',
              fontSize: '14px',
            }}>
              {['简洁直观的 DSL 语法', '内置 RSI / BOLL 等指标函数', '语法高亮 & 模板复制', '策略回测一键验证'].map((item) => (
                <li key={item} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#10b981', fontSize: '16px' }}>✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{
        padding: '100px 48px',
        textAlign: 'center',
        background: 'var(--bg-0)',
        borderTop: '1px solid var(--border-color)',
      }}>
        <h2 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '16px' }}>
          开始你的量化交易之旅
        </h2>
        <p style={{ color: 'var(--text-2)', marginBottom: '40px', fontSize: '16px' }}>
          注册即可体验完整功能，快速构建属于你的交易策略
        </p>
        <Button
          size="large"
          theme="solid"
          onClick={handleGetStarted}
          style={{ padding: '14px 48px', fontSize: '16px' }}
        >
          {isAuthenticated ? '进入控制台' : '免费注册'}
        </Button>
      </section>

      {/* Footer */}
      <footer style={{
        padding: '32px 48px',
        textAlign: 'center',
        color: 'var(--text-3)',
        borderTop: '1px solid var(--border-color)',
        fontSize: '13px',
      }}>
        <p>© 2026 HQuant. All rights reserved.</p>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div style={{
      padding: '32px',
      background: 'var(--bg-2)',
      borderRadius: '12px',
      border: '1px solid var(--border-color)',
      transition: 'transform 0.2s, box-shadow 0.2s',
    }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)'
        e.currentTarget.style.boxShadow = '0 12px 40px rgba(99,102,241,0.12)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div style={{ color: '#6366f1', marginBottom: '16px' }}>
        {icon}
      </div>
      <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '10px' }}>
        {title}
      </h3>
      <p style={{ color: 'var(--text-2)', lineHeight: 1.7, fontSize: '14px' }}>
        {description}
      </p>
    </div>
  )
}
