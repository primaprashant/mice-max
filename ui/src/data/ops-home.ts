// Static data for the /ops company page: agents, work-flow edges, the hero's scripted
// loop and the JADM32 timeline. Agents mirror backend/app/ai/control.py AGENTS.

export type Dept = 'setup' | 'operations' | 'growth' | 'reporting';
export type AgentMode = 'live' | 'replay' | 'next';
export type Text = { en: string; ja: string };

export interface Agent {
  id: string;
  dept: Dept;
  role_en: string;
  role_ja: string;
  tool: string;
  link: string;
  mode: AgentMode;
}

export const DEMO_CONF = 'jadm32';
const C = `/ops/${DEMO_CONF}`;
const RUN = '/ops/run';

export const DEPTS: { id: Dept; en: string; ja: string; color: string }[] = [
  { id: 'setup', en: 'Setup', ja: 'セットアップ', color: '#38bdf8' },
  { id: 'operations', en: 'Operations', ja: '運営', color: '#a78bfa' },
  { id: 'growth', en: 'Growth', ja: '成長', color: '#34d399' },
  { id: 'reporting', en: 'Reporting', ja: '報告', color: '#f472b6' },
];

export const AGENTS: Agent[] = [
  { id: 'reader', dept: 'setup', role_en: 'Reads the conference website', role_ja: '会議のウェブサイトを読む', tool: 'search', link: RUN, mode: 'live' },
  { id: 'scheduler', dept: 'setup', role_en: 'Extracts the session schedule', role_ja: 'セッション日程を抽出する', tool: 'llm', link: RUN, mode: 'live' },
  { id: 'sorter', dept: 'setup', role_en: 'Sorts must-attend and skippable sessions', role_ja: '必須と任意のセッションを分ける', tool: 'llm', link: RUN, mode: 'live' },
  { id: 'window-finder', dept: 'setup', role_en: "Finds attendees' free time", role_ja: '参加者の空き時間を見つける', tool: 'rules', link: RUN, mode: 'live' },
  { id: 'audience', dept: 'setup', role_en: 'Estimates who attends and their interests', role_ja: '参加者層と関心を推定する', tool: 'llm', link: RUN, mode: 'live' },
  { id: 'filter', dept: 'setup', role_en: 'Checks experiences against the graph', role_ja: '体験をグラフで確認する', tool: 'graph', link: RUN, mode: 'live' },
  { id: 'builder', dept: 'setup', role_en: 'Builds experiences and specialist visits', role_ja: '体験と専門視察を組み立てる', tool: 'llm', link: RUN, mode: 'live' },
  { id: 'ranker', dept: 'setup', role_en: 'Picks the top experiences per free window', role_ja: '空き時間ごとに上位の体験を選ぶ', tool: 'llm', link: RUN, mode: 'live' },
  { id: 'writer', dept: 'setup', role_en: 'Writes the JA/EN page and email', role_ja: '日英のページとメールを書く', tool: 'llm', link: RUN, mode: 'live' },
  { id: 'mailer', dept: 'operations', role_en: 'Sends emails and reminders', role_ja: 'メールとリマインダーを送る', tool: 'rules', link: C, mode: 'replay' },
  { id: 'booker', dept: 'operations', role_en: 'Calls businesses to book (voice)', role_ja: '事業者に電話で予約する（音声）', tool: 'voice', link: C, mode: 'live' },
  { id: 'concierge', dept: 'operations', role_en: 'Answers attendee questions', role_ja: '参加者の質問に答える', tool: 'llm', link: `/c/${DEMO_CONF}`, mode: 'live' },
  { id: 'organizer-assistant', dept: 'operations', role_en: 'Answers organizer questions', role_ja: '主催者の質問に答える', tool: 'llm', link: `/organize/${DEMO_CONF}`, mode: 'live' },
  { id: 'replanner', dept: 'operations', role_en: 'Replans when transport stops', role_ja: '交通が止まったら計画を立て直す', tool: 'graph', link: C, mode: 'live' },
  { id: 'group-filler', dept: 'operations', role_en: 'Fills groups and nudges', role_ja: 'グループを埋めて声をかける', tool: 'rules', link: C, mode: 'replay' },
  { id: 'host-assigner', dept: 'operations', role_en: 'Assigns a host to each group', role_ja: '各グループに案内役を割り当てる', tool: 'rules', link: C, mode: 'replay' },
  { id: 'sales', dept: 'growth', role_en: 'Finds conferences and drafts outreach', role_ja: '会議を見つけて営業文を書く', tool: 'llm', link: '/ops/sales', mode: 'live' },
  { id: 'reporter', dept: 'reporting', role_en: 'Weekly reports to the organizer', role_ja: '主催者への週次報告', tool: 'rules', link: C, mode: 'replay' },
  { id: 'city-report', dept: 'reporting', role_en: "Writes the city's results report", role_ja: '市への成果報告を書く', tool: 'llm', link: '/city', mode: 'next' },
];

export const HUMAN = {
  id: 'human',
  role_en: 'Approves sends and handles hand-offs',
  role_ja: '送信を承認し、引き継ぎに対応する',
  label_en: 'Human',
  label_ja: '人間',
};

const SETUP_CHAIN = AGENTS.filter((a) => a.dept === 'setup').map((a) => a.id);

/** Work-flow edges [from, to]. */
export const EDGES: [string, string][] = [
  ...SETUP_CHAIN.slice(1).map((id, i): [string, string] => [SETUP_CHAIN[i], id]),
  ['writer', 'mailer'],
  ['writer', 'booker'],
  ['writer', 'concierge'],
  ['writer', 'organizer-assistant'],
  ['mailer', 'group-filler'],
  ['group-filler', 'host-assigner'],
  ['booker', 'replanner'],
  ['concierge', 'human'],
  ['organizer-assistant', 'human'],
  ['replanner', 'reporter'],
  ['host-assigner', 'reporter'],
  ['concierge', 'reporter'],
  ['reporter', 'city-report'],
  ['reporter', 'sales'],
  ['sales', 'reader'],
];

/** Hero loop beat kinds:
 * comet: a bright head with a tail from off-screen (or `from`) to `to`, with an optional label
 * chain: a pulse runs along the setup chain, `node` bubbles shown as it arrives
 * burst: many small particles from `from` to `to`
 * ring: a ring pulse with a waveform at `node`
 * sparks: back-and-forth sparks between `from` and `to`
 * alert: `node` flashes amber
 * spark: one spark from `from` to `to`
 * flow: a stream of particles from `from` to `to` */
export type BeatKind = 'comet' | 'chain' | 'burst' | 'ring' | 'sparks' | 'alert' | 'spark' | 'flow';

export interface Beat {
  at: number; // seconds from loop start
  kind: BeatKind;
  node?: string;
  from?: string;
  to?: string;
  label?: Text; // text that travels with a comet
  bubble?: Text; // thought bubble over the target node
}

export const LOOP_SECONDS = 40;

export const SCRIPT: Beat[] = [
  { at: 0, kind: 'comet', to: 'reader', label: { en: 'convention.co.jp/32jadm', ja: 'convention.co.jp/32jadm' }, bubble: { en: 'Reading the JADM32 website', ja: 'JADM32のサイトを読んでいます' } },
  { at: 2.5, kind: 'chain', node: 'scheduler', bubble: { en: '210 sessions found', ja: '210セッションを抽出' } },
  { at: 4.5, kind: 'chain', node: 'sorter', bubble: { en: 'Must-attend vs skippable', ja: '必須と任意を仕分け' } },
  { at: 6.5, kind: 'chain', node: 'window-finder', bubble: { en: '15 free windows', ja: '空き時間 15枠' } },
  { at: 8.5, kind: 'chain', node: 'audience', bubble: { en: 'Nurses 30%, physicians 25%', ja: '看護師30%、医師25%' } },
  { at: 10.5, kind: 'chain', node: 'filter', bubble: { en: '276 fit, 361 ruled out', ja: '適合276件、除外361件' } },
  { at: 12.5, kind: 'chain', node: 'builder', bubble: { en: 'Jozankei onsen evening', ja: '定山渓温泉の夜' } },
  { at: 14.5, kind: 'chain', node: 'ranker', bubble: { en: 'Mt Moiwa night view ranks first', ja: '藻岩山の夜景が1位' } },
  { at: 16.5, kind: 'chain', node: 'writer', bubble: { en: 'JA/EN page and email ready', ja: '日英ページとメール完成' } },
  { at: 19, kind: 'burst', from: 'writer', to: 'mailer', bubble: { en: 'Emailing 3,000 attendees', ja: '参加者3,000人にメール送信' } },
  { at: 20.5, kind: 'ring', node: 'booker', bubble: { en: 'Calling to book the Makomanai shuttle', ja: '真駒内シャトルを電話で予約' } },
  { at: 22, kind: 'sparks', from: 'writer', to: 'concierge', bubble: { en: 'Is the onsen tattoo-friendly?', ja: '温泉はタトゥー可？' } },
  { at: 25, kind: 'alert', node: 'replanner', bubble: { en: 'Snow stopped the Jozankei bus. Replanning', ja: '大雪で定山渓バス運休。再計画中' } },
  { at: 26.5, kind: 'flow', from: 'replanner', to: 'reporter' },
  { at: 28.5, kind: 'spark', from: 'concierge', to: 'human', bubble: { en: 'Handed to a person: refund question', ja: '人に引き継ぎ：返金の質問' } },
  { at: 31.5, kind: 'flow', from: 'host-assigner', to: 'reporter', bubble: { en: 'Weekly report sent', ja: '週次報告を送信' } },
  { at: 33.5, kind: 'flow', from: 'reporter', to: 'city-report', bubble: { en: 'Results for the city', ja: '市への成果' } },
  { at: 35.5, kind: 'comet', from: 'sales', to: 'reader', label: { en: 'Next: Japan Venous Talk 2027', ja: '次：Japan Venous Talk 2027' }, bubble: { en: 'Found the next conference', ja: '次の会議を発見' } },
];

export interface TimelineBeat {
  time_en: string;
  time_ja: string;
  agents: string[];
  text_en: string;
  text_ja: string;
  link: string;
}

export const TIMELINE: TimelineBeat[] = [
  { time_en: 'T+0', time_ja: 'T+0', agents: ['reader'], text_en: 'The organizer pastes the conference URL and the site is read.', text_ja: '主催者が会議のURLを貼り付け、サイトを読み込みます。', link: RUN },
  { time_en: 'T+1 min', time_ja: 'T+1分', agents: ['scheduler', 'sorter'], text_en: '210 sessions are extracted and sorted into must-attend and skippable.', text_ja: '210のセッションを抽出し、必須と任意に分けます。', link: RUN },
  { time_en: 'T+2 min', time_ja: 'T+2分', agents: ['window-finder'], text_en: "15 free windows are found in attendees' schedules.", text_ja: '参加者の日程から15の空き時間を見つけます。', link: RUN },
  { time_en: 'T+3 min', time_ja: 'T+3分', agents: ['filter'], text_en: '276 fits across 15 windows; 361 ruled out, each with a reason such as "too long" or "too late to start".', text_ja: '15枠で276件が適合。361件は「長すぎる」「開始が遅すぎる」など理由付きで除外します。', link: RUN },
  { time_en: 'T+4 min', time_ja: 'T+4分', agents: ['writer'], text_en: 'A JA/EN page and email are ready for the organizer.', text_ja: '主催者向けの日英ページとメールが完成します。', link: `/organize/${DEMO_CONF}` },
  { time_en: 'Weeks before', time_ja: '数週間前', agents: ['mailer', 'group-filler'], text_en: 'Emails and reminders go out; groups that need people get a nudge.', text_ja: 'メールとリマインダーを送り、人数の足りないグループに声をかけます。', link: C },
  { time_en: '2 days before', time_ja: '2日前', agents: ['booker'], text_en: 'The booker calls the ryokan to book the Makomanai shuttle by voice.', text_ja: '予約エージェントが旅館に電話し、真駒内シャトルを音声で予約します。', link: C },
  { time_en: 'Conference day', time_ja: '会議当日', agents: ['replanner'], text_en: 'Snow stops the Jozankei bus; guests are replanned and messaged.', text_ja: '大雪で定山渓行きバスが運休。参加者の予定を立て直し、連絡します。', link: C },
  { time_en: 'Day after', time_ja: '翌日', agents: ['reporter'], text_en: 'Results go to the city view.', text_ja: '成果が市のビューに届きます。', link: '/city' },
];

export function agentById(id: string): Agent | undefined {
  return AGENTS.find((a) => a.id === id);
}

export function deptColor(dept: Dept): string {
  return DEPTS.find((d) => d.id === dept)!.color;
}
