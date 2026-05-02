import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type {
  Session,
  BillingPlan,
  UserProfile,
  UserSubscription,
  Report,
  SessionMessagesResponse,
  CreateSessionPayload,
  UpdateScheduledSessionPayload,
  JoinCallResponse,
  StartCallResponse
} from '@lingua/shared';
import {
  startWebVoiceClient,
  type WebVoiceClientController,
  type WebVoiceClientState
} from '../lib/webVoiceClient';
import {
  attachOrDisposeResolvedController,
  planLiveSessionEnd
} from '../features/session/liveSession';
import {
  getSessionConstraintState,
  selectSessionSpotlight
} from '../features/session/sessionLaunchView';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import LanguagePicker from '../components/ui/LanguagePicker';
import { AppShell, HeroSection } from '../components/layout/AppShell';
import { SectionCard, MetricCard, StatusBanner, EmptyState } from '../components/layout/SectionCard';
import { useUser } from '../context/UserContext';
import { apiClient, describeApiError, normalizeApiError } from '../lib/api';
import { getFriendlyCopy, getLanguageDisplayName } from '../content/friendlyCopy';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

type ActiveWebVoiceSession = {
  sessionId: string;
  state: WebVoiceClientState;
  transcript: string[];
  controller: WebVoiceClientController | null;
  note?: string;
  isSpeaking: boolean;
};

const ACTIVE_SESSION_STATUSES = ['connecting', 'dialing', 'ringing', 'in_progress', 'ending'];
const SESSION_POLL_INTERVAL_MS = 4000;

function formatSessionTime(utc?: string) {
  if (!utc) return 'n/a';
  const date = new Date(utc);
  if (Number.isNaN(date.getTime())) return utc;
  return date.toLocaleString();
}

function getSessionStatusLabel(status: string, isKo: boolean) {
  const labels: Record<string, { ko: string; en: string }> = {
    ready: { ko: '시작 가능', en: 'Ready' },
    scheduled: { ko: '예약됨', en: 'Scheduled' },
    connecting: { ko: '연결 중', en: 'Connecting' },
    dialing: { ko: '전화 연결 중', en: 'Dialing' },
    ringing: { ko: '응답 대기 중', en: 'Ringing' },
    in_progress: { ko: '진행 중', en: 'Live' },
    ending: { ko: '종료 중', en: 'Ending' },
    completed: { ko: '완료됨', en: 'Completed' },
    cancelled: { ko: '취소됨', en: 'Cancelled' },
    failed: { ko: '실패', en: 'Failed' },
    provider_error: { ko: '연결 문제', en: 'Provider issue' },
    user_cancelled: { ko: '사용자 종료', en: 'Ended by user' },
    schedule_missed: { ko: '예약 시간 경과', en: 'Missed schedule' },
    no_answer: { ko: '응답 없음', en: 'No answer' }
  };

  const label = labels[status];
  return label ? (isKo ? label.ko : label.en) : status.replace(/_/g, ' ');
}

function getContactModeLabel(mode: string, isKo: boolean) {
  if (mode === 'scheduled_once') return isKo ? '예약 세션' : 'Scheduled';
  if (mode === 'immediate') return isKo ? '즉시 세션' : 'Start now';
  return mode.replace(/_/g, ' ');
}

function toDateTimeLocalValue(utc?: string) {
  if (!utc) return '';
  const date = new Date(utc);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function canJoinScheduledSession(session: Session) {
  if (session.status !== 'scheduled' || !session.scheduledForAtUtc) return false;
  const scheduledAt = new Date(session.scheduledForAtUtc).getTime();
  if (Number.isNaN(scheduledAt)) return false;
  return Date.now() >= scheduledAt - 10 * 60 * 1000;
}

function getStatusBadgeVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' | 'indigo' | 'softRed' {
  if (['in_progress', 'connecting'].includes(status)) return 'default';
  if (status === 'completed') return 'indigo';
  if (['failed', 'cancelled', 'provider_error', 'user_cancelled', 'schedule_missed', 'no_answer'].includes(status)) {
    return 'softRed';
  }
  return 'outline';
}

type DetailState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'report'; report: Report }
  | { kind: 'transcript'; data: SessionMessagesResponse }
  | { kind: 'error'; message: string };

type TopicOption = { value: string; labelKey: string };
type LangExamConfig = {
  exam: string;
  defaultLevel: string;
  defaultTopic: string;
  levelOptions: string[];
  topicOptions: TopicOption[];
};

const LANG_CONFIGS: Record<string, LangExamConfig> = {
  en: {
    exam: 'opic',
    defaultLevel: 'IM3',
    defaultTopic: 'daily conversation',
    levelOptions: ['NL', 'NM', 'NH', 'IL', 'IM1', 'IM2', 'IM3', 'IH', 'AL'],
    topicOptions: [
      { value: 'daily conversation', labelKey: 'en_daily' },
      { value: 'travel', labelKey: 'en_travel' },
      { value: 'work & career', labelKey: 'en_work' },
      { value: 'technology', labelKey: 'en_tech' },
      { value: 'environment', labelKey: 'en_environment' },
      { value: 'health', labelKey: 'en_health' },
      { value: 'education', labelKey: 'en_education' }
    ]
  },
  de: {
    exam: 'goethe_b2',
    defaultLevel: 'B1',
    defaultTopic: 'Studium und Beruf',
    levelOptions: ['A2', 'B1', 'B2'],
    topicOptions: [
      { value: 'Studium und Beruf', labelKey: 'de_study' },
      { value: 'Gesellschaft und Kultur', labelKey: 'de_society' },
      { value: 'Umwelt und Natur', labelKey: 'de_environment' },
      { value: 'Gesundheit', labelKey: 'de_health' },
      { value: 'Reisen', labelKey: 'de_travel' },
      { value: 'Technik und Medien', labelKey: 'de_tech' },
      { value: 'Kunst und Literatur', labelKey: 'de_art' }
    ]
  },
  zh: {
    exam: 'hsk5',
    defaultLevel: 'HSK4',
    defaultTopic: 'work & profession',
    levelOptions: ['HSK3', 'HSK4', 'HSK5'],
    topicOptions: [
      { value: 'work & profession', labelKey: 'zh_work' },
      { value: 'culture & society', labelKey: 'zh_culture' },
      { value: 'technology & innovation', labelKey: 'zh_tech' },
      { value: 'environment & nature', labelKey: 'zh_environment' },
      { value: 'travel & life', labelKey: 'zh_travel' },
      { value: 'education & learning', labelKey: 'zh_education' }
    ]
  },
  es: {
    exam: 'dele_b1',
    defaultLevel: 'A2',
    defaultTopic: 'vida cotidiana',
    levelOptions: ['A1', 'A2', 'B1'],
    topicOptions: [
      { value: 'vida cotidiana', labelKey: 'es_daily' },
      { value: 'viajes y turismo', labelKey: 'es_travel' },
      { value: 'trabajo y profesion', labelKey: 'es_work' },
      { value: 'cultura y sociedad', labelKey: 'es_culture' },
      { value: 'salud', labelKey: 'es_health' },
      { value: 'tecnologia', labelKey: 'es_tech' }
    ]
  },
  ja: {
    exam: 'jlpt_n2',
    defaultLevel: 'N3',
    defaultTopic: 'work & daily life',
    levelOptions: ['N4', 'N3', 'N2', 'N1'],
    topicOptions: [
      { value: 'work & daily life', labelKey: 'ja_work' },
      { value: 'travel & tourism', labelKey: 'ja_travel' },
      { value: 'society & culture', labelKey: 'ja_society' },
      { value: 'technology & innovation', labelKey: 'ja_tech' },
      { value: 'environment & nature', labelKey: 'ja_environment' },
      { value: 'education & learning', labelKey: 'ja_education' },
      { value: 'health & life', labelKey: 'ja_health' }
    ]
  },
  fr: {
    exam: 'delf_b1',
    defaultLevel: 'A2',
    defaultTopic: 'vie quotidienne',
    levelOptions: ['A1', 'A2', 'B1'],
    topicOptions: [
      { value: 'vie quotidienne', labelKey: 'fr_daily' },
      { value: 'voyages et tourisme', labelKey: 'fr_travel' },
      { value: 'travail et carriere', labelKey: 'fr_work' },
      { value: 'culture et societe', labelKey: 'fr_culture' },
      { value: 'sante', labelKey: 'fr_health' },
      { value: 'technologie', labelKey: 'fr_tech' },
      { value: 'environnement', labelKey: 'fr_environment' }
    ]
  }
};

export default function ScreenSession() {
  const { t, i18n } = useTranslation();
  const { getToken, refreshSession, clearIdentity } = useUser();
  const navigate = useNavigate();
  const copy = getFriendlyCopy(i18n.language);
  const isKo = i18n.language.startsWith('ko');

  const [language, setLanguage] = useState<'en' | 'de' | 'zh' | 'es' | 'ja' | 'fr'>('en');
  const [mode, setMode] = useState<'immediate' | 'scheduled_once'>('immediate');
  const [level, setLevel] = useState('IM3');
  const [topic, setTopic] = useState('daily conversation');
  const [duration, setDuration] = useState(10);
  const [scheduledFor, setScheduledFor] = useState('');
  const [durationOptions, setDurationOptions] = useState([10]);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formMessage, setFormMessage] = useState('');

  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [globalMessage, setGlobalMessage] = useState('');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [plans, setPlans] = useState<BillingPlan[]>([]);

  const activeRef = useRef<ActiveWebVoiceSession | null>(null);
  const [activeSession, setActiveSession] = useState<ActiveWebVoiceSession | null>(null);

  const [editTimes, setEditTimes] = useState<Record<string, string>>({});
  const [detail, setDetail] = useState<DetailState>({ kind: 'idle' });

  const composerRef = useRef<HTMLDivElement | null>(null);
  const historyRef = useRef<HTMLDivElement | null>(null);
  const detailRef = useRef<HTMLDivElement | null>(null);

  const makeApi = useCallback(() => apiClient(getToken, refreshSession), [getToken, refreshSession]);

  const handleLanguageChange = (lang: 'en' | 'de' | 'zh' | 'es' | 'ja' | 'fr') => {
    const cfg = LANG_CONFIGS[lang];
    setLanguage(lang);
    setLevel(cfg.defaultLevel);
    setTopic(cfg.defaultTopic);
  };

  const loadAccountState = useCallback(async () => {
    const api = makeApi();
    try {
      const [nextProfile, nextPlans, nextSubscription] = await Promise.all([
        api.get<UserProfile>('/users/me'),
        api.get<BillingPlan[]>('/billing/plans'),
        api.get<UserSubscription | null>('/billing/subscription').catch(() => null)
      ]);

      setProfile(nextProfile);
      setPlans(nextPlans);
      setSubscription(nextSubscription);

      const activePlan =
        nextPlans.find(plan => plan.code === nextProfile.planCode) ??
        nextPlans.find(plan => plan.code === 'free');
      const max = activePlan?.maxSessionMinutes && activePlan.maxSessionMinutes >= 10
        ? activePlan.maxSessionMinutes
        : 10;
      const options = [10];
      if (max >= 15) options.push(15);
      setDurationOptions([...new Set(options)].sort((a, b) => a - b));
      if (!options.includes(duration)) {
        setDuration(options[0]);
      }
    } catch {
      setDurationOptions([10]);
    }
  }, [duration, makeApi]);

  const loadSessions = useCallback(async (showLoading = true) => {
    const api = makeApi();
    if (showLoading) setSessionsLoading(true);
    try {
      const list = await api.get<Session[]>('/sessions');
      setSessions(list);
    } catch {
      setGlobalMessage(isKo ? '세션 목록을 불러오지 못했습니다. 다시 시도해 주세요.' : 'Failed to load sessions. Please try again.');
    } finally {
      if (showLoading) setSessionsLoading(false);
    }
  }, [isKo, makeApi]);

  useEffect(() => {
    void loadAccountState();
    void loadSessions();
  }, [loadAccountState, loadSessions]);

  const sessionsRef = useRef<Session[]>([]);
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const shouldPoll =
        sessionsRef.current.some(
          session =>
            ACTIVE_SESSION_STATUSES.includes(session.status) ||
            session.reportStatus === 'pending'
        ) || !!activeRef.current;

      if (shouldPoll) {
        void loadSessions(false);
      }
    }, SESSION_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadSessions]);

  const syncActive = (next: ActiveWebVoiceSession | null) => {
    activeRef.current = next;
    setActiveSession(next ? { ...next } : null);
  };

  const TERMINAL_STATUSES = ['completed', 'cancelled', 'failed', 'no_answer', 'user_cancelled', 'provider_error', 'schedule_missed'];

  const handleDelete = async (sessionId: string) => {
    const api = makeApi();
    try {
      await api.delete(`/sessions/${sessionId}`);
      await loadSessions(false);
    } catch (err) {
      setGlobalMessage(describeApiError(err, 'session_delete'));
    }
  };

  const beginWebVoiceSession = async (sessionId: string, join: boolean) => {
    if (activeRef.current?.controller) {
      setGlobalMessage(isKo ? '이미 진행 중인 통화가 있습니다. 먼저 현재 통화를 종료해 주세요.' : 'Another live call is already active. End the current call first.');
      return;
    }
    const api = makeApi();

    const initial: ActiveWebVoiceSession = {
      sessionId,
      state: 'connecting',
      transcript: [],
      controller: null,
      note: isKo ? '실시간 음성 연결을 준비하고 있습니다...' : 'Preparing your live audio session...',
      isSpeaking: false
    };
    syncActive(initial);

    try {
      const bootstrap: StartCallResponse | JoinCallResponse = join
        ? await api.post<JoinCallResponse>(`/calls/${sessionId}/join`, {})
        : await api.post<StartCallResponse>('/calls/initiate', { sessionId });

      const controller = await startWebVoiceClient({
        apiBase: API_BASE,
        bootstrap: bootstrap as StartCallResponse,
        headers: await api.headers(),
        pttMode: true,
        earlyExitKeywords: [
          '끝내자', '그만하자', '종료', '세션 종료', '종료할게', '그만할게',
          "let's finish", "let's stop", "end session", "stop session", "finish", "goodbye", "that's all",
          "terminemos", "finalizar", "fin de sesión",
          "arrêtons", "terminer", "fin de session",
          "beenden wir", "sitzung beenden", "schluss",
          "終わりにしよう", "セッション終了", "やめよう",
          "结束吧", "结束会话", "好了"
        ],
        onEarlyExit: () => {
          setGlobalMessage(isKo ? '종료 요청이 감지되어 세션을 마무리합니다.' : 'Exit request detected. Wrapping up the session.');
        },
        onStateChange: (state, message) => {
          if (!activeRef.current || activeRef.current.sessionId !== sessionId) return;
          syncActive({ ...activeRef.current, state, note: message });
          if (state === 'live') {
            setGlobalMessage(isKo ? '통화가 연결되었습니다. 편하게 말해 보세요.' : 'Your call is live. Speak naturally.');
            void loadSessions();
          }
          if (state === 'ended') {
            setGlobalMessage(isKo ? '통화가 종료되었습니다. 리포트는 잠시 후 확인할 수 있습니다.' : 'Call ended. Your report should appear shortly.');
            syncActive(null);
            void loadSessions();
          }
          if (state === 'failed') {
            setGlobalMessage(isKo ? '실시간 통화 연결에 실패했습니다. 마이크나 네트워크를 확인한 뒤 다시 시도해 주세요.' : 'Live call failed to connect. Check your microphone or network and try again.');
            syncActive(null);
            void loadSessions();
          }
        },
        onTranscriptChange: transcript => {
          if (!activeRef.current || activeRef.current.sessionId !== sessionId) return;
          const lines = transcript.map(entry => `${entry.role}: ${entry.content}`);
          syncActive({ ...activeRef.current, transcript: lines });
        }
      });

      const resolution = await attachOrDisposeResolvedController({
        activeSession: activeRef.current,
        sessionId,
        controller,
        connectedNote: isKo ? 'OpenAI 음성 연결을 준비하고 있습니다...' : 'Waiting for OpenAI Realtime connection...'
      });

      if (resolution.kind === 'attached') {
        // Use activeRef.current (not the stale snapshot) to preserve any state
        // transitions (e.g. 'live') that may have fired during the await above.
        if (activeRef.current && activeRef.current.sessionId === sessionId) {
          syncActive({ ...activeRef.current, controller });
        } else {
          syncActive(resolution.nextActiveSession);
        }
      }
    } catch (error) {
      syncActive(null);
      setGlobalMessage(
        isKo
          ? `통화를 시작하지 못했습니다: ${describeApiError(error, join ? 'call_join' : 'call_start')}`
          : `Call start failed: ${describeApiError(error, join ? 'call_join' : 'call_start')}`
      );
      await loadSessions();
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const api = makeApi();
    setFormLoading(true);
    setFormError('');
    setFormMessage('');
    try {
      const payload: CreateSessionPayload = {
        language,
        exam: LANG_CONFIGS[language].exam as CreateSessionPayload['exam'],
        level,
        topic,
        durationMinutes: duration,
        contactMode: mode,
        scheduledForAtUtc:
          mode === 'scheduled_once' && scheduledFor
            ? new Date(scheduledFor).toISOString()
            : undefined,
        timezone: 'Asia/Seoul'
      };
      const session = await api.post<Session>('/sessions', payload);
      setDetail({ kind: 'idle' });
      await Promise.all([loadSessions(), loadAccountState()]);
      if (session.contactMode === 'scheduled_once') {
        setFormMessage(
          isKo
            ? `${formatSessionTime(session.scheduledForAtUtc)}에 예약 세션을 만들었습니다.`
            : `Scheduled session created for ${formatSessionTime(session.scheduledForAtUtc)}`
        );
        historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        setFormMessage(isKo ? '세션을 만들었습니다. 통화를 연결하는 중입니다...' : 'Session created. Connecting your call...');
        void beginWebVoiceSession(session.id, false);
      }
    } catch (err) {
      setFormError(describeApiError(err, 'session_create'));
    } finally {
      setFormLoading(false);
    }
  };

  const handleViewReport = async (sessionId: string) => {
    const api = makeApi();
    setDetail({ kind: 'loading' });
    detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try {
      let report: Report;
      try {
        report = await api.get<Report>(`/sessions/${sessionId}/report`);
      } catch (err) {
        const normalized = normalizeApiError(err);
        if (!['not_found', 'conflict'].includes(normalized.code)) throw err;
        report = await api.post<Report>(`/sessions/${sessionId}/report`, {});
      }
      setDetail({ kind: 'report', report });
    } catch (err) {
      setDetail({ kind: 'error', message: describeApiError(err, 'report_load') });
    }
  };

  const handleViewTranscript = async (sessionId: string) => {
    const api = makeApi();
    setDetail({ kind: 'loading' });
    detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try {
      const data = await api.get<SessionMessagesResponse>(`/sessions/${sessionId}/messages?limit=50`);
      setDetail({ kind: 'transcript', data });
    } catch (err) {
      setDetail({ kind: 'error', message: describeApiError(err, 'transcript_load') });
    }
  };

  const handleUpdateSchedule = async (sessionId: string) => {
    const api = makeApi();
    const time = editTimes[sessionId];
    if (!time) {
      setGlobalMessage(isKo ? '예약 시간이 필요합니다.' : 'Scheduled time is required.');
      return;
    }
    try {
      const payload: UpdateScheduledSessionPayload = {
        scheduledForAtUtc: new Date(time).toISOString(),
        timezone: 'Asia/Seoul'
      };
      const updated = await api.patch<Session>(`/sessions/${sessionId}`, payload);
      setGlobalMessage(
        isKo
          ? `예약 시간을 ${formatSessionTime(updated.scheduledForAtUtc)}로 변경했습니다.`
          : `Schedule updated to ${formatSessionTime(updated.scheduledForAtUtc)}`
      );
      setDetail({ kind: 'idle' });
      await loadSessions();
    } catch (err) {
      setGlobalMessage(
        isKo
          ? `일정 변경에 실패했습니다: ${describeApiError(err, 'session_update')}`
          : `Schedule update failed: ${describeApiError(err, 'session_update')}`
      );
    }
  };

  const handleCancel = async (sessionId: string) => {
    const api = makeApi();
    try {
      await api.post<Session>(`/sessions/${sessionId}/cancel`, {});
      setGlobalMessage(isKo ? '세션을 취소했습니다.' : 'Session cancelled.');
      setDetail({ kind: 'idle' });
      await Promise.all([loadSessions(), loadAccountState()]);
    } catch (err) {
      setGlobalMessage(
        isKo
          ? `세션 취소에 실패했습니다: ${describeApiError(err, 'session_cancel')}`
          : `Session cancel failed: ${describeApiError(err, 'session_cancel')}`
      );
    }
  };

  const handleEndCall = async (sessionId: string) => {
    const api = makeApi();
    const activePlan = planLiveSessionEnd(activeRef.current, sessionId, t('session.endCall'));

    if (activePlan.nextActiveSession !== activeRef.current) {
      syncActive(activePlan.nextActiveSession as ActiveWebVoiceSession | null);
    }

    if (activePlan.kind === 'controller') {
      try {
        await activePlan.nextActiveSession.controller?.end();
      } catch (err) {
        syncActive(null);
        try {
          await api.post<Session>(`/calls/${sessionId}/end`, {});
          setGlobalMessage(isKo ? '통화가 종료되었습니다. 리포트는 잠시 후 확인할 수 있습니다.' : 'Call ended. Your report should appear shortly.');
        } catch (fallbackErr) {
          setGlobalMessage(
            isKo
              ? `통화를 종료하지 못했습니다: ${describeApiError(fallbackErr, 'call_end')}`
              : `Call end failed: ${describeApiError(fallbackErr, 'call_end')}`
          );
        }
        await Promise.all([loadSessions(), loadAccountState()]);
      }
      return;
    }

    try {
      await api.post<Session>(`/calls/${sessionId}/end`, {});
      setGlobalMessage(isKo ? '통화가 종료되었습니다. 리포트는 잠시 후 확인할 수 있습니다.' : 'Call ended. Your report should appear shortly.');
      setDetail({ kind: 'idle' });
      await Promise.all([loadSessions(), loadAccountState()]);
    } catch (err) {
      setGlobalMessage(
        isKo
          ? `통화를 종료하지 못했습니다: ${describeApiError(err, 'call_end')}`
          : `Call end failed: ${describeApiError(err, 'call_end')}`
      );
    }
  };

  const activePlanDetails = plans.find(plan => plan.code === profile?.planCode) ?? null;
  const spotlight = selectSessionSpotlight({
    activeSessionId: activeSession?.sessionId ?? null,
    sessions
  });

  const constraintMessage =
    getSessionConstraintState(durationOptions) === 'ten_or_fifteen'
      ? copy.session.constraintTenOrFifteen
      : copy.session.constraintTenMinuteOnly;

  const spotlightTitle =
    spotlight.kind === 'live'
      ? copy.session.spotlightLiveTitle
      : spotlight.kind === 'scheduled'
        ? copy.session.spotlightScheduledTitle
        : copy.session.spotlightEmptyTitle;

  const spotlightDescription =
    spotlight.kind === 'live'
      ? copy.session.spotlightLiveDescription
      : spotlight.kind === 'scheduled'
        ? `${copy.session.spotlightScheduledPrefix} ${formatSessionTime(spotlight.scheduledForAtUtc)}`
        : copy.session.spotlightEmptyDescription;

  const readyNowLabel =
    profile?.paidMinutesBalance && profile.paidMinutesBalance > 0
      ? (isKo ? '지금 바로 쓸 수 있는 분수' : 'Minutes ready now')
      : (isKo ? '남은 체험 통화' : 'Trial calls left');

  const readyNowValue =
    profile?.paidMinutesBalance && profile.paidMinutesBalance > 0
      ? `${profile.paidMinutesBalance} min`
      : String(profile?.trialCallsRemaining ?? 0);

  const bannerTone = /failed|error|못했습니다|실패했습니다|필요합니다/i.test(globalMessage) ? 'danger' : 'neutral';

  return (
    <AppShell
      headerActions={
        <>
          <LanguagePicker />
          <Button variant="outline" size="sm" onClick={() => navigate('/billing')}>
            {t('nav.billing')}
          </Button>
          <Button variant="ghost" size="sm" onClick={clearIdentity}>
            {t('nav.signOut')}
          </Button>
        </>
      }
    >
      <HeroSection
        eyebrow={copy.session.eyebrow}
        title={copy.session.title}
        description={copy.session.description}
        aside={
          <div className="space-y-3">
            <MetricCard
              label={isKo ? '현재 플랜' : 'Current plan'}
              value={activePlanDetails?.displayName ?? (profile?.planCode ?? 'free')}
              tone="primary"
              detail={subscription?.status ?? (isKo ? '활성 상태' : 'active state')}
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <MetricCard
                label={readyNowLabel}
                value={readyNowValue}
              />
              <MetricCard
                label={isKo ? '세션 길이 기준' : 'Session length access'}
                value={getSessionConstraintState(durationOptions) === 'ten_or_fifteen' ? '10 / 15 min' : '10 min'}
                detail={constraintMessage}
              />
            </div>
          </div>
        }
      />

      {globalMessage && <StatusBanner tone={bannerTone}>{globalMessage}</StatusBanner>}
      {formMessage && <StatusBanner tone="success">{formMessage}</StatusBanner>}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          {activeSession && (
            <LiveSessionCard
              title={copy.session.liveTitle}
              description={copy.session.liveDescription}
              activeSession={activeSession}
              onEnd={() => void handleEndCall(activeSession.sessionId)}
              onTogglePtt={() => {
                if (!activeRef.current?.controller) return;
                if (activeRef.current.isSpeaking) {
                  activeRef.current.controller.stopSpeaking();
                  syncActive({ ...activeRef.current, isSpeaking: false });
                } else {
                  activeRef.current.controller.startSpeaking();
                  syncActive({ ...activeRef.current, isSpeaking: true });
                }
              }}
              isKo={isKo}
            />
          )}

          <SectionCard title={spotlightTitle} description={spotlightDescription}>
            <StatusBanner>{constraintMessage}</StatusBanner>
            <div className="grid gap-3 sm:grid-cols-3">
              {copy.session.quickActions.map((action) => (
                <div key={action.title} className="rounded-xl border border-border bg-secondary px-4 py-4">
                  <div className="text-sm font-semibold text-foreground">{action.title}</div>
                  <div className="mt-2 text-sm leading-6 text-muted-foreground">{action.description}</div>
                </div>
              ))}
            </div>
          </SectionCard>

          <div ref={composerRef}>
            <SectionCard title={copy.session.composerTitle} description={copy.session.composerDescription}>
              <form onSubmit={event => void handleFormSubmit(event)} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t('session.language')}</Label>
                    <Select value={language} onValueChange={value => handleLanguageChange(value as 'en' | 'de' | 'zh' | 'es' | 'ja' | 'fr')}>
                      <SelectTrigger className="rounded-2xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(LANG_CONFIGS).map(code => (
                          <SelectItem key={code} value={code}>
                            {getLanguageDisplayName(code)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('session.mode')}</Label>
                    <Select value={mode} onValueChange={value => setMode(value as 'immediate' | 'scheduled_once')}>
                      <SelectTrigger className="rounded-2xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="immediate">{t('session.modeImmediate')}</SelectItem>
                        <SelectItem value="scheduled_once">{t('session.modeScheduled')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t('session.level')}</Label>
                    <Select value={level} onValueChange={setLevel}>
                      <SelectTrigger className="rounded-2xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LANG_CONFIGS[language].levelOptions.map(option => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('session.topic')}</Label>
                    <Select value={topic} onValueChange={setTopic}>
                      <SelectTrigger className="rounded-2xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LANG_CONFIGS[language].topicOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {t(`session.topicLabels.${option.labelKey}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-[0.55fr_0.45fr]">
                  <div className="space-y-2">
                    <Label>{t('session.duration')}</Label>
                    <Select value={String(duration)} onValueChange={value => setDuration(Number(value))}>
                      <SelectTrigger className="rounded-2xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {durationOptions.map(option => (
                          <SelectItem key={option} value={String(option)}>
                            {option} min
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {mode === 'scheduled_once' && (
                    <div className="space-y-2">
                      <Label htmlFor="scheduledFor">{t('session.scheduleTime')}</Label>
                      <Input
                        id="scheduledFor"
                        type="datetime-local"
                        className="h-10 rounded-2xl"
                        value={scheduledFor}
                        onChange={event => setScheduledFor(event.target.value)}
                      />
                    </div>
                  )}
                </div>

                {formError && <StatusBanner tone="danger">{formError}</StatusBanner>}

                <div className="flex flex-wrap gap-3">
                  <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={formLoading}>
                    {formLoading ? t('session.creating') : t('session.createSession')}
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto"
                    onClick={() => historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  >
                    {copy.session.historyTitle}
                  </Button>
                </div>
              </form>
            </SectionCard>
          </div>
        </div>

        <div className="space-y-6">
          <div ref={detailRef}>
            <SectionCard title={copy.session.detailTitle} description={copy.session.detailDescription}>
              <DetailPanel
                detail={detail}
                onClose={() => setDetail({ kind: 'idle' })}
                onOpenStandalone={report => navigate(`/report/${encodeURIComponent(report.publicId)}`)}
                isKo={isKo}
              />
            </SectionCard>
          </div>
        </div>
      </div>

      <div ref={historyRef}>
        <SectionCard
          title={t('session.sessionList')}
          description={copy.session.historyDescription}
        action={
          <Button variant="outline" size="sm" onClick={() => void Promise.all([loadSessions(), loadAccountState()])}>
            {t('billing.reload')}
          </Button>
        }
      >
        {sessionsLoading ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : sessions.length === 0 ? (
          <EmptyState
            title={isKo ? '아직 세션이 없습니다' : 'No sessions yet'}
            description={isKo
              ? '첫 번째 짧은 통화를 만들어 보세요. 바로 시작하거나 예약해 둘 수 있습니다.'
              : 'Create your first short call. You can start right away or schedule it for later.'}
            action={
              <Button onClick={() => composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                {isKo ? '세션 만들기' : 'Create a session'}
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            {sessions.map(session => (
              <SessionRow
                key={session.id}
                session={session}
                editValue={editTimes[session.id] ?? toDateTimeLocalValue(session.scheduledForAtUtc)}
                onEditTimeChange={value => setEditTimes(prev => ({ ...prev, [session.id]: value }))}
                onUpdateSchedule={() => void handleUpdateSchedule(session.id)}
                onStart={() => void beginWebVoiceSession(session.id, false)}
                onJoin={() => void beginWebVoiceSession(session.id, true)}
                onCancel={() => void handleCancel(session.id)}
                onEnd={() => void handleEndCall(session.id)}
                onDelete={() => void handleDelete(session.id)}
                onViewReport={() => void handleViewReport(session.id)}
                onViewTranscript={() => void handleViewTranscript(session.id)}
                t={t}
                isKo={isKo}
              />
            ))}
          </div>
        )}
        </SectionCard>
      </div>
    </AppShell>
  );
}

function TranscriptLine({ line }: { line: string }) {
  const { getToken } = useUser();
  const { i18n, t } = useTranslation();
  const [translation, setTranslation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleTranslate = async () => {
    if (translation !== null) { setTranslation(null); return; }
    setLoading(true);
    try {
      const api = apiClient(getToken);
      const res = await api.post<{ translation: string }>('/translate', {
        text: line,
        targetLang: i18n.language
      });
      setTranslation(res.translation);
    } catch {
      // ignore — user can retry
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-start gap-2">
        <p className="flex-1 text-sm leading-6 text-foreground">{line}</p>
        <button
          type="button"
          onClick={() => void handleTranslate()}
          disabled={loading}
          className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10 disabled:opacity-50 transition-colors"
        >
          {loading ? t('session.translating') : translation !== null ? t('session.translateClose') : t('session.translate')}
        </button>
      </div>
      {translation !== null && (
        <p className="text-xs leading-5 text-muted-foreground">{translation}</p>
      )}
    </div>
  );
}

function LiveSessionCard({
  title,
  description,
  activeSession,
  onEnd,
  onTogglePtt,
  isKo
}: {
  title: string;
  description: string;
  activeSession: ActiveWebVoiceSession;
  onEnd: () => void;
  onTogglePtt?: () => void;
  isKo: boolean;
}) {
  const { t } = useTranslation();
  return (
    <SectionCard title={title} description={description}>
      <div className="space-y-4 rounded-xl border border-primary/15 bg-primary/[0.05] px-5 py-5">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="text-sm font-medium text-foreground">
              {activeSession.note ?? getSessionStatusLabel(activeSession.state, isKo)}
            </div>
            <div className="text-xs text-muted-foreground">
              {isKo ? '세션 ID' : 'Session ID'}: {activeSession.sessionId}
            </div>
          </div>
          <Badge variant={activeSession.state === 'live' ? 'default' : 'secondary'}>
            {getSessionStatusLabel(activeSession.state, isKo)}
          </Badge>
        </div>

        {activeSession.transcript.length > 0 ? (
          <div className="max-h-48 space-y-3 overflow-y-auto rounded-xl border border-border bg-card p-4">
            {activeSession.transcript.slice(-6).map((line, index) => (
              <TranscriptLine key={`${line}-${index}`} line={line} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-background px-4 py-5 text-sm text-muted-foreground">
            {isKo ? '첫 대화 내용이 들어오면 여기에 바로 표시됩니다.' : 'The first line of conversation will appear here.'}
          </div>
        )}

        {activeSession.state === 'live' && activeSession.controller && onTogglePtt && (
          <Button
            size="lg"
            className="w-full"
            variant={activeSession.isSpeaking ? 'default' : 'outline'}
            onClick={onTogglePtt}
          >
            {activeSession.isSpeaking ? (
              <><span className="mr-2 h-2 w-2 rounded-full bg-primary-foreground animate-pulse inline-block" />{t('session.pttStop')}</>
            ) : (
              t('session.pttStart')
            )}
          </Button>
        )}

        <Button variant="destructive" onClick={onEnd}>
          {isKo ? '통화 종료' : 'End call'}
        </Button>
      </div>
    </SectionCard>
  );
}


function SessionRow({
  session,
  editValue,
  onEditTimeChange,
  onUpdateSchedule,
  onStart,
  onJoin,
  onCancel,
  onEnd,
  onDelete,
  onViewReport,
  onViewTranscript,
  t,
  isKo
}: {
  session: Session;
  editValue: string;
  onEditTimeChange: (value: string) => void;
  onUpdateSchedule: () => void;
  onStart: () => void;
  onJoin: () => void;
  onCancel: () => void;
  onEnd: () => void;
  onDelete?: () => void;
  onViewReport: () => void;
  onViewTranscript: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
  isKo: boolean;
}) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={getStatusBadgeVariant(session.status)}>
              {getSessionStatusLabel(session.status, isKo)}
            </Badge>
            <Badge variant="outline">{getContactModeLabel(session.contactMode, isKo)}</Badge>
            {session.reportStatus === 'pending' && (
              <Badge variant="secondary">{isKo ? '리포트 생성 중' : 'Report in progress'}</Badge>
            )}
          </div>
          <div className="space-y-1">
            <div className="text-lg font-semibold tracking-tight text-slate-950">
              {getLanguageDisplayName(session.language)} / {session.level}
            </div>
            <div className="text-sm text-muted-foreground">
              {session.topic} / {session.durationMinutes} min
            </div>
            {session.scheduledForAtUtc && (
              <div className="text-sm text-muted-foreground">
                {isKo ? '예약 시간' : 'Scheduled for'}: {formatSessionTime(session.scheduledForAtUtc)}
              </div>
            )}
            {session.failureReason && (
              <div className="text-sm text-destructive">{isKo ? '문제' : 'Issue'}: {session.failureReason}</div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {session.status === 'ready' && <Button size="sm" onClick={onStart}>{t('session.startCall')}</Button>}
          {session.status === 'scheduled' && canJoinScheduledSession(session) && (
            <Button size="sm" onClick={onJoin}>{t('session.joinSession')}</Button>
          )}
          {session.status === 'scheduled' && (
            <Button size="sm" variant="destructive" onClick={onCancel}>
              {t('session.cancelSession')}
            </Button>
          )}
          {['connecting', 'dialing', 'ringing', 'in_progress', 'ending'].includes(session.status) && (
            <Button size="sm" variant="destructive" onClick={onEnd}>
              {t('session.endCall')}
            </Button>
          )}
          {session.status === 'completed' && (
            <>
              <Button size="sm" variant="outline" onClick={onViewReport}>
                {t('session.viewReport')}
              </Button>
              <Button size="sm" variant="ghost" onClick={onViewTranscript}>
                {t('session.viewTranscript')}
              </Button>
            </>
          )}
          {session.callId && session.status !== 'completed' && (
            <Button size="sm" variant="ghost" onClick={onViewTranscript}>
              {t('session.viewTranscript')}
            </Button>
          )}
          {onDelete && ['completed', 'cancelled', 'failed', 'no_answer', 'user_cancelled', 'provider_error', 'schedule_missed'].includes(session.status) && (
            <Button size="sm" variant="ghost" onClick={onDelete} title={isKo ? '삭제' : 'Delete'}>
              🗑
            </Button>
          )}
        </div>
      </div>

      {session.status === 'scheduled' && (
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <Input
            type="datetime-local"
            className="rounded-2xl"
            value={editValue}
            onChange={event => onEditTimeChange(event.target.value)}
          />
          <Button variant="outline" onClick={onUpdateSchedule}>
            {isKo ? '일정 변경' : 'Update schedule'}
          </Button>
        </div>
      )}
    </div>
  );
}

function DetailPanel({
  detail,
  onClose,
  onOpenStandalone,
  isKo
}: {
  detail: DetailState;
  onClose: () => void;
  onOpenStandalone: (report: Report) => void;
  isKo: boolean;
}) {
  if (detail.kind === 'idle') {
    return (
      <EmptyState
        title={isKo ? '아직 열린 상세 정보가 없습니다' : 'Nothing open yet'}
        description={
          isKo
            ? '최근 세션의 리포트나 transcript 버튼을 누르면 이 패널에서 바로 내용을 확인할 수 있습니다.'
            : 'Use report or transcript actions from a recent session. The detail panel stays out of the way until you need it.'
        }
      />
    );
  }

  if (detail.kind === 'loading') {
    return <StatusBanner>{isKo ? '상세 정보를 불러오는 중입니다...' : 'Loading detail...'}</StatusBanner>;
  }

  if (detail.kind === 'error') {
    return <StatusBanner tone="danger">{detail.message}</StatusBanner>;
  }

  if (detail.kind === 'transcript') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant="secondary">{isKo ? '대화록' : 'Transcript'}</Badge>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {isKo ? '닫기' : 'Close'}
          </Button>
        </div>
        <div className="max-h-72 space-y-2 overflow-y-auto rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
          {detail.data.messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">{isKo ? '아직 transcript가 없습니다.' : 'No transcript yet.'}</p>
          ) : (
            detail.data.messages.map(message => (
              <div key={message.sequenceNo} className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                <span className="font-semibold capitalize text-slate-950">{message.role}:</span>{' '}
                {message.content}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant={detail.report.status === 'ready' ? 'default' : 'secondary'}>
          {detail.report.status === 'ready'
            ? (isKo ? '리포트 준비 완료' : 'Report ready')
            : detail.report.status === 'failed'
              ? (isKo ? '리포트 생성 실패' : 'Report failed')
              : detail.report.status}
        </Badge>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenStandalone(detail.report)}>
            {isKo ? '전체 리포트 열기' : 'Open full report'}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {isKo ? '닫기' : 'Close'}
          </Button>
        </div>
      </div>
      <InlineReport report={detail.report} />
    </div>
  );
}

function InlineReport({ report }: { report: Report }) {
  const { t } = useTranslation();
  const ev = report.evaluation;

  return (
    <div className="space-y-4 text-sm">
      {ev && (
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { label: t('report.scores.total'), value: ev.totalScore },
            { label: t('report.scores.grammar'), value: ev.grammarScore },
            { label: t('report.scores.vocabulary'), value: ev.vocabularyScore },
            { label: t('report.scores.fluency'), value: ev.fluencyScore }
          ].map(item => (
            <MetricCard key={item.label} label={item.label} value={String(item.value)} />
          ))}
        </div>
      )}
      {report.summaryText && (
        <div className="rounded-3xl border border-slate-200 bg-slate-50/80 px-4 py-4 text-sm leading-6 text-slate-700">
          {report.summaryText}
        </div>
      )}
      {report.recommendations?.length > 0 && (
        <div className="grid gap-3">
          {report.recommendations.map((recommendation, index) => (
            <div key={`${recommendation}-${index}`} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
              {recommendation}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
