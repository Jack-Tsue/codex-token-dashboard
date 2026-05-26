import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CircleDollarSign,
  Database,
  FolderGit2,
  RefreshCw,
  Settings2,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import './styles.css';

const DEFAULT_PRICES = {
  latestCodex: {
    label: 'gpt-5.2-codex',
    input: 1.75,
    cached: 0.175,
    output: 14,
  },
  miniCodex: {
    label: 'gpt-5.1-codex-mini',
    input: 0.25,
    cached: 0.025,
    output: 2,
  },
};

const MODEL_MAP = {
  'gpt-5.5': 'latestCodex',
  'gpt-5.4': 'latestCodex',
  'gpt-5.2': 'latestCodex',
  'codex-auto-review': 'latestCodex',
  'gpt-5.1-codex-mini': 'miniCodex',
  'gpt-5.4-mini': 'miniCodex',
};

const numberFmt = new Intl.NumberFormat('zh-CN');
const compactFmt = new Intl.NumberFormat('zh-CN', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
const usdFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});
const cnyFmt = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  maximumFractionDigits: 2,
});

function App() {
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState({
    source: 'all',
    model: 'all',
    cwd: 'all',
    startDate: '',
    endDate: '',
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [prices, setPrices] = useState(DEFAULT_PRICES);
  const [fxRate, setFxRate] = useState(7.2);

  useEffect(() => {
    loadUsage();
  }, []);

  async function loadUsage(force = false) {
    setError('');
    force ? setRefreshing(true) : setLoading(true);
    try {
      const response = await fetch(force ? '/api/refresh' : '/api/usage', {
        method: force ? 'POST' : 'GET',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setRaw(data);
      setFilters((current) => fillDefaultDateRange(current, data.events || []));
    } catch (err) {
      setError(`读取 Codex 日志失败：${err.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const events = useMemo(() => raw?.events || [], [raw]);
  const filterOptions = useMemo(() => getFilterOptions(events), [events]);
  const filteredEvents = useMemo(
    () => applyFilters(events, filters),
    [events, filters]
  );
  const analytics = useMemo(
    () => buildAnalytics(filteredEvents, prices),
    [filteredEvents, prices]
  );
  const allAnalytics = useMemo(() => buildAnalytics(events, prices), [events, prices]);

  if (loading) {
    return (
      <Shell>
        <div className="loading-panel">
          <Sparkles size={24} />
          <span>正在读取 Codex token 日志...</span>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <header className="topbar">
        <div>
          <p className="eyebrow">Codex Usage Ledger</p>
          <h1>Token 用量看板</h1>
          <p className="subtle">
            按 last_token_usage 聚合，金额按 OpenAI API 公开价格估算。
          </p>
        </div>
        <div className="topbar-actions">
          <button className="icon-button" onClick={() => setSettingsOpen(!settingsOpen)} title="设置">
            <Settings2 size={18} />
          </button>
          <button className="primary-button" onClick={() => loadUsage(true)} disabled={refreshing}>
            <RefreshCw size={17} className={refreshing ? 'spin' : ''} />
            {refreshing ? '刷新中' : '刷新数据'}
          </button>
        </div>
      </header>

      {error && (
        <Notice tone="danger" icon={<AlertTriangle size={18} />}>
          {error}
        </Notice>
      )}

      <section className="filter-strip">
        <Select
          label="范围"
          value={filters.source}
          onChange={(source) => setFilters({ ...filters, source })}
          options={[
            ['all', '全部日志'],
            ['current', '当前日志'],
            ['archived', '归档日志'],
          ]}
        />
        <Select
          label="模型"
          value={filters.model}
          onChange={(model) => setFilters({ ...filters, model })}
          options={filterOptions.models}
        />
        <Select
          label="项目"
          value={filters.cwd}
          onChange={(cwd) => setFilters({ ...filters, cwd })}
          options={filterOptions.cwdList}
        />
        <DateField
          label="开始"
          value={filters.startDate}
          onChange={(startDate) => setFilters({ ...filters, startDate })}
        />
        <DateField
          label="结束"
          value={filters.endDate}
          onChange={(endDate) => setFilters({ ...filters, endDate })}
        />
      </section>

      {settingsOpen && (
        <SettingsPanel
          prices={prices}
          setPrices={setPrices}
          fxRate={fxRate}
          setFxRate={setFxRate}
        />
      )}

      <section className="kpi-grid">
        <KpiCard
          icon={<Activity size={18} />}
          label="今日 Token"
          value={compactFmt.format(analytics.today.totalTokens)}
          detail={`${numberFmt.format(analytics.today.totalTokens)} tokens`}
        />
        <KpiCard
          icon={<CircleDollarSign size={18} />}
          label="今日估算金额"
          value={usdFmt.format(analytics.today.costUsd)}
          detail={cnyFmt.format(analytics.today.costUsd * fxRate)}
        />
        <KpiCard
          icon={<Database size={18} />}
          label="历史总量"
          value={compactFmt.format(analytics.total.totalTokens)}
          detail={`${numberFmt.format(analytics.total.totalTokens)} tokens`}
        />
        <KpiCard
          icon={<TrendingUp size={18} />}
          label="历史估算金额"
          value={usdFmt.format(analytics.total.costUsd)}
          detail={cnyFmt.format(analytics.total.costUsd * fxRate)}
        />
        <KpiCard
          icon={<Sparkles size={18} />}
          label="缓存命中率"
          value={`${Math.round(analytics.cacheRate * 100)}%`}
          detail={`${compactFmt.format(analytics.total.cachedInputTokens)} cached`}
        />
        <KpiCard
          icon={<CalendarDays size={18} />}
          label="平均每日"
          value={compactFmt.format(analytics.averageDailyTokens)}
          detail={`${analytics.days.length} 个有效日期`}
        />
      </section>

      <section className="main-grid">
        <Panel className="trend-panel" title="每日趋势" meta="Token 与估算金额">
          <TrendChart data={analytics.days} />
        </Panel>
        <Panel title="用量热力图" meta="按 Asia/Shanghai 日期归属">
          <Heatmap data={allAnalytics.days} selectedStart={filters.startDate} selectedEnd={filters.endDate} />
        </Panel>
      </section>

      <section className="split-grid">
        <Panel className="model-panel" title="模型占比" meta="按 token 总量">
          <ModelChart data={analytics.models} />
        </Panel>
        <Panel title="项目占比" meta="按 cwd 聚合">
          <RankList rows={analytics.projects} kind="project" />
        </Panel>
      </section>

      <section className="split-grid bottom-grid">
        <Panel title="高峰记录" meta="Top days and sessions">
          <PeakTable peaks={analytics.peaks} />
        </Panel>
        <Panel title="扫描状态" meta={`${raw?.fileCount || 0} 个文件，${raw?.eventCount || 0} 条 token 事件`}>
          <ScanStatus raw={raw} analytics={analytics} />
        </Panel>
      </section>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <main className="app-shell">
      <div className="page-texture" />
      <div className="content">{children}</div>
    </main>
  );
}

function Notice({ children, icon, tone = 'default' }) {
  return <div className={`notice ${tone}`}>{icon}{children}</div>;
}

function Panel({ title, meta, className = '', children }) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <h2>{title}</h2>
        <span>{meta}</span>
      </div>
      {children}
    </section>
  );
}

function KpiCard({ icon, label, value, detail }) {
  return (
    <article className="kpi-card">
      <div className="kpi-icon">{icon}</div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
    </article>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}

function DateField({ label, value, onChange }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type="date" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SettingsPanel({ prices, setPrices, fxRate, setFxRate }) {
  function updatePrice(group, field, value) {
    setPrices({
      ...prices,
      [group]: {
        ...prices[group],
        [field]: Number(value || 0),
      },
    });
  }

  return (
    <section className="settings-panel">
      <div>
        <h2>价格与映射</h2>
        <p>
          官方价格按每 100 万 token 计算。内部模型名映射为估算口径，可在这里调整。
        </p>
      </div>
      <div className="settings-grid">
        {Object.entries(prices).map(([key, price]) => (
          <div className="price-box" key={key}>
            <strong>{price.label}</strong>
            <label>Input <input value={price.input} type="number" step="0.001" onChange={(event) => updatePrice(key, 'input', event.target.value)} /></label>
            <label>Cached <input value={price.cached} type="number" step="0.001" onChange={(event) => updatePrice(key, 'cached', event.target.value)} /></label>
            <label>Output <input value={price.output} type="number" step="0.001" onChange={(event) => updatePrice(key, 'output', event.target.value)} /></label>
          </div>
        ))}
        <div className="price-box mapping-box">
          <strong>模型映射</strong>
          <p>gpt-5.5 / gpt-5.4 / gpt-5.2 / codex-auto-review → gpt-5.2-codex</p>
          <p>gpt-5.1-codex-mini / gpt-5.4-mini → mini</p>
          <label>USD → CNY <input value={fxRate} type="number" step="0.01" onChange={(event) => setFxRate(Number(event.target.value || 0))} /></label>
        </div>
      </div>
    </section>
  );
}

function TrendChart({ data }) {
  if (!data.length) return <EmptyState text="当前筛选条件下没有趋势数据" />;
  return (
    <div className="chart-frame">
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ left: 4, right: 12, top: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="tokenFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c96442" stopOpacity={0.42} />
              <stop offset="100%" stopColor="#c96442" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#e4ddd2" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: '#6f665c', fontSize: 12 }} tickMargin={10} />
          <YAxis tickFormatter={(value) => compactFmt.format(value)} tick={{ fill: '#6f665c', fontSize: 12 }} width={56} />
          <Tooltip content={<ChartTooltip />} />
          <Area type="monotone" dataKey="totalTokens" name="Total" stroke="#9f4d36" fill="url(#tokenFill)" strokeWidth={2.5} />
          <Area type="monotone" dataKey="cachedInputTokens" name="Cached" stroke="#6d8b74" fill="transparent" strokeWidth={1.8} />
          <Area type="monotone" dataKey="outputTokens" name="Output" stroke="#3f6574" fill="transparent" strokeWidth={1.8} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ModelChart({ data }) {
  if (!data.length) return <EmptyState text="没有模型数据" />;
  const colors = ['#9f4d36', '#6d8b74', '#3f6574', '#bd915d', '#766b9d', '#8a8276'];
  const rows = data.slice(0, 8);
  return (
    <div className="chart-frame compact-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ left: 2, right: 14, top: 4, bottom: 4 }} barCategoryGap={12}>
          <CartesianGrid stroke="#e4ddd2" horizontal={false} />
          <XAxis type="number" tickFormatter={(value) => compactFmt.format(value)} tick={{ fill: '#6f665c', fontSize: 12 }} />
          <YAxis type="category" dataKey="model" width={104} tick={{ fill: '#4a4038', fontSize: 12 }} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="totalTokens" radius={[0, 4, 4, 0]} barSize={28}>
            {rows.map((entry, index) => (
              <Cell key={entry.model} fill={colors[index % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload || {};
  return (
    <div className="chart-tooltip">
      <strong>{label || row.model}</strong>
      {payload.map((item) => (
        <span key={item.dataKey}>
          {item.name || item.dataKey}: {numberFmt.format(item.value || 0)}
        </span>
      ))}
      {row.costUsd != null && <span>Cost: {usdFmt.format(row.costUsd)}</span>}
    </div>
  );
}

function Heatmap({ data, selectedStart, selectedEnd }) {
  if (!data.length) return <EmptyState text="没有可展示的热力图数据" />;
  const { cells, months, startDate, endDate } = buildHeatmapCells(data);
  const max = Math.max(...data.map((day) => day.totalTokens), 1);
  return (
    <div className="heatmap-wrap">
      <div className="heatmap-months" style={{ '--weeks': cells.length / 7 }}>
        <span />
        <div className="month-track">
          {months.map((month) => (
            <span key={`${month.label}-${month.week}`} style={{ gridColumn: `${month.week + 1} / span ${month.span}` }}>
              {month.label}
            </span>
          ))}
        </div>
      </div>
      <div className="heatmap-grid" style={{ '--weeks': cells.length / 7 }}>
        <div className="weekday-labels">
          <span>一</span>
          <span />
          <span>三</span>
          <span />
          <span>五</span>
          <span />
          <span>日</span>
        </div>
        <div className="heatmap">
          {cells.map((cell) => (
            <div
              key={cell.date}
              className={`heat-cell ${isDateInRange(cell.date, selectedStart, selectedEnd) ? 'selected' : ''}`}
              style={{ '--heat': heatLevel(cell.totalTokens, max) }}
              title={`${cell.date}: ${numberFmt.format(cell.totalTokens)} tokens`}
            />
          ))}
        </div>
      </div>
      <div className="heatmap-footer">
        <span>{startDate} 至 {endDate}</span>
        <div className="heatmap-legend">
          <span>少</span>
          {[0, 0.25, 0.5, 0.75, 1].map((level) => (
            <i key={level} style={{ '--heat': level }} />
          ))}
          <span>多</span>
        </div>
      </div>
    </div>
  );
}

function RankList({ rows, kind }) {
  if (!rows.length) return <EmptyState text="没有项目数据" />;
  return (
    <div className="rank-list">
      {rows.slice(0, 8).map((row, index) => (
        <div className="rank-row" key={row.cwd || row.model}>
          <span className="rank-index">{index + 1}</span>
          <div>
            <strong title={row.cwd}>{kind === 'project' ? row.projectName : row.model}</strong>
            <small>{compactFmt.format(row.totalTokens)} tokens · {usdFmt.format(row.costUsd)}</small>
          </div>
          <div className="rank-bar"><span style={{ width: `${row.share * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

function PeakTable({ peaks }) {
  const rows = [
    ['最高用量日', peaks.topDay?.date, peaks.topDay?.totalTokens, peaks.topDay?.costUsd],
    ['最高成本日', peaks.topCostDay?.date, peaks.topCostDay?.totalTokens, peaks.topCostDay?.costUsd],
    ['最高会话', peaks.topSession?.sessionName, peaks.topSession?.totalTokens, peaks.topSession?.costUsd],
    ['缓存最多会话', peaks.topCachedSession?.sessionName, peaks.topCachedSession?.cachedInputTokens, peaks.topCachedSession?.costUsd],
  ];

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>指标</th><th>对象</th><th>Token</th><th>金额</th></tr>
        </thead>
        <tbody>
          {rows.map(([label, target, tokens, cost]) => (
            <tr key={label}>
              <td>{label}</td>
              <td>{target || '-'}</td>
              <td>{tokens ? numberFmt.format(tokens) : '-'}</td>
              <td>{cost != null ? usdFmt.format(cost) : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScanStatus({ raw, analytics }) {
  const warnings = raw?.warnings || [];
  return (
    <div className="status-stack">
      <div className="status-line">
        <FolderGit2 size={17} />
        <span>{analytics.sessions.length} 个会话，{analytics.models.length} 个模型，{analytics.projects.length} 个项目路径。</span>
      </div>
      <div className="status-line">
        <Database size={17} />
        <span>扫描耗时 {raw?.scanMs || 0}ms，生成于 {formatTime(raw?.generatedAt)}。</span>
      </div>
      <Notice tone={warnings.length ? 'warn' : 'ok'} icon={warnings.length ? <AlertTriangle size={17} /> : <Sparkles size={17} />}>
        {warnings.length ? `${warnings.length} 条解析提示，已跳过异常行。` : '日志解析正常，没有发现异常行。'}
      </Notice>
      {warnings.length > 0 && (
        <div className="warning-list">
          {warnings.slice(0, 5).map((warning, index) => (
            <p key={`${warning.type}-${index}`}>{warning.message}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ text }) {
  return <div className="empty-state">{text}</div>;
}

function fillDefaultDateRange(current, events) {
  if (current.startDate || current.endDate || !events.length) return current;
  const dates = [...new Set(events.map((event) => event.date))].sort();
  return {
    ...current,
    startDate: dates[0],
    endDate: dates[dates.length - 1],
  };
}

function getFilterOptions(events) {
  const models = [...new Set(events.map((event) => event.model || 'unknown'))].sort();
  const cwdList = [...new Map(events.map((event) => [
    event.cwd || 'unknown',
    event.projectName || projectNameFromPath(event.cwd || 'unknown'),
  ]))].sort((a, b) => a[1].localeCompare(b[1], 'zh-CN'));
  return {
    models: [['all', '全部模型'], ...models.map((model) => [model, model])],
    cwdList: [['all', '全部项目'], ...cwdList],
  };
}

function applyFilters(events, filters) {
  return events.filter((event) => {
    if (filters.source !== 'all' && event.source !== filters.source) return false;
    if (filters.model !== 'all' && event.model !== filters.model) return false;
    if (filters.cwd !== 'all' && event.cwd !== filters.cwd) return false;
    if (filters.startDate && event.date < filters.startDate) return false;
    if (filters.endDate && event.date > filters.endDate) return false;
    return true;
  });
}

function buildAnalytics(events, prices) {
  const today = shanghaiToday();
  const daily = new Map();
  const models = new Map();
  const projects = new Map();
  const sessions = new Map();
  const total = emptyTotals();

  for (const event of events) {
    const costUsd = estimateCost(event, prices);
    addTo(total, event, costUsd);
    addToMap(daily, event.date, event, costUsd, { date: event.date });
    addToMap(models, event.model, event, costUsd, { model: event.model });
    addToMap(projects, event.cwd, event, costUsd, {
      cwd: event.cwd,
      projectName: event.projectName || projectNameFromPath(event.cwd),
    });
    addToMap(sessions, event.sessionId, event, costUsd, {
      sessionId: event.sessionId,
      sessionName: event.sessionName || shortSession(event.sessionId),
      cwd: event.cwd,
      projectName: event.projectName || projectNameFromPath(event.cwd),
      model: event.model,
    });
  }

  const days = [...daily.values()].sort((a, b) => a.date.localeCompare(b.date));
  const modelRows = withShares([...models.values()].sort((a, b) => b.totalTokens - a.totalTokens));
  const projectRows = withShares([...projects.values()].sort((a, b) => b.totalTokens - a.totalTokens));
  const sessionRows = [...sessions.values()].sort((a, b) => b.totalTokens - a.totalTokens);
  const todayRow = daily.get(today) || emptyTotals({ date: today });

  return {
    total,
    today: todayRow,
    days,
    models: modelRows,
    projects: projectRows,
    sessions: sessionRows,
    cacheRate: total.inputTokens ? total.cachedInputTokens / total.inputTokens : 0,
    averageDailyTokens: days.length ? total.totalTokens / days.length : 0,
    peaks: {
      topDay: maxBy(days, 'totalTokens'),
      topCostDay: maxBy(days, 'costUsd'),
      topSession: maxBy(sessionRows, 'totalTokens'),
      topCachedSession: maxBy(sessionRows, 'cachedInputTokens'),
    },
  };
}

function estimateCost(event, prices) {
  const priceKey = MODEL_MAP[event.model] || 'latestCodex';
  const price = prices[priceKey] || prices.latestCodex;
  return (
    (event.uncachedInputTokens / 1_000_000) * price.input +
    (event.cachedInputTokens / 1_000_000) * price.cached +
    (event.outputTokens / 1_000_000) * price.output
  );
}

function addToMap(map, key, event, costUsd, base) {
  if (!map.has(key)) map.set(key, emptyTotals(base));
  addTo(map.get(key), event, costUsd);
}

function addTo(target, event, costUsd) {
  target.inputTokens += event.inputTokens;
  target.cachedInputTokens += event.cachedInputTokens;
  target.uncachedInputTokens += event.uncachedInputTokens;
  target.outputTokens += event.outputTokens;
  target.reasoningOutputTokens += event.reasoningOutputTokens;
  target.totalTokens += event.totalTokens;
  target.costUsd += costUsd;
  target.eventCount += 1;
}

function emptyTotals(extra = {}) {
  return {
    inputTokens: 0,
    cachedInputTokens: 0,
    uncachedInputTokens: 0,
    outputTokens: 0,
    reasoningOutputTokens: 0,
    totalTokens: 0,
    costUsd: 0,
    eventCount: 0,
    ...extra,
  };
}

function withShares(rows) {
  const max = Math.max(...rows.map((row) => row.totalTokens), 1);
  return rows.map((row) => ({ ...row, share: row.totalTokens / max }));
}

function maxBy(rows, field) {
  return rows.reduce((best, row) => (!best || row[field] > best[field] ? row : best), null);
}

function buildHeatmapCells(days) {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const start = new Date(`${days[0].date}T00:00:00`);
  const end = new Date(`${days[days.length - 1].date}T00:00:00`);
  const startOffset = (start.getDay() + 6) % 7;
  const endOffset = (end.getDay() + 6) % 7;
  start.setDate(start.getDate() - startOffset);
  end.setDate(end.getDate() + (6 - endOffset));

  const cells = [];
  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const date = cursor.toISOString().slice(0, 10);
    cells.push({ date, totalTokens: byDate.get(date)?.totalTokens || 0 });
  }
  return {
    cells,
    months: buildMonthLabels(cells),
    startDate: days[0].date,
    endDate: days[days.length - 1].date,
  };
}

function buildMonthLabels(cells) {
  const weekCount = cells.length / 7;
  const labels = [];
  let active = null;

  for (let week = 0; week < weekCount; week += 1) {
    const monday = cells[week * 7]?.date;
    const month = Number(monday.slice(5, 7));
    const label = `${month}月`;
    if (!active || active.label !== label) {
      active = { label, week, span: 1 };
      labels.push(active);
    } else {
      active.span += 1;
    }
  }

  return labels;
}

function heatLevel(value, max) {
  if (!value) return 0;
  return Math.max(0.14, Math.log1p(value) / Math.log1p(max));
}

function isDateInRange(date, start, end) {
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
}

function projectNameFromPath(value = '') {
  if (!value || value === 'unknown') return 'unknown';
  const parts = value.replace(/\/+$/, '').split('/').filter(Boolean);
  return parts.at(-1) || value;
}

function shortSession(value = '') {
  if (!value) return '';
  return value.length > 14 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}

function shanghaiToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function formatTime(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

createRoot(document.getElementById('root')).render(<App />);
