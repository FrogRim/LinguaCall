export type LocalizedCopy = ReturnType<typeof getFriendlyCopy>;

const COPY = {
  en: {
    common: {
      privacy: 'Privacy',
      terms: 'Terms',
      quickPractice: 'Short, light, steady practice'
    },
    login: {
      eyebrow: 'Friendly AI speaking practice',
      title: 'Practice speaking in short calls that actually fit your day.',
      description:
        'LinguaCall helps you build a steady speaking habit with fast setup, short sessions, and simple feedback after each call.',
      bullets: [
        'Start with a short session instead of a long study block.',
        'Use a demo session without SMS setup or payment friction.',
        'Paid upgrades are visible for product context, but payment is disabled in the portfolio demo.'
      ],
      primaryCta: 'Try the demo now',
      primaryCtaLoading: 'Preparing demo access...',
      secondaryCta: 'Compare plans first',
      secondaryCtaAppsInToss: 'Compare plans in Apps in Toss',
      valueTitle: 'Why people trust it',
      valueSummary:
        'The product keeps the first step small: one demo session, one quick call, one clear next action.'
    },
    verify: {
      eyebrow: 'Quick verification',
      title: 'Confirm your phone number and step straight into practice.',
      description:
        'This only takes a moment. After the first verification, the app keeps your session active on this device.',
      stepsTitle: 'What happens next',
      steps: [
        'Enter your number and request a one-time code.',
        'Confirm the code to create your secure session.',
        'Start a short practice call now, or review plans later; paid upgrades are disabled in this portfolio demo.'
      ],
      supportTitle: 'Built to feel low pressure',
      supportCopy:
        'The goal is to get you speaking quickly. Billing code is prepared, but live payment is intentionally parked for portfolio use.'
    },
    session: {
      eyebrow: 'Practice hub',
      title: 'See the next speaking action first, then move straight into it.',
      description:
        'Keep the page centered on the next useful step: return to a live call, confirm the nearest reservation, or start one short session now.',
      spotlightLiveTitle: 'Live session in progress',
      spotlightLiveDescription: 'Return to the active call first before browsing anything else.',
      spotlightScheduledTitle: 'Your next reserved session',
      spotlightScheduledPrefix: 'The nearest scheduled session is set for',
      spotlightEmptyTitle: 'Nothing urgent is waiting',
      spotlightEmptyDescription: 'Start with a short session now, or schedule one clear time later.',
      constraintTenMinuteOnly: 'Your current access starts with the shortest demo session.',
      constraintTenOrFifteen: 'Your current plan supports multiple demo session lengths.',
      quickActionsTitle: 'Start with one clear action',
      quickActions: [
        {
          title: 'Start a short session',
          description: 'Create a new call in a few taps and jump into speaking.'
        },
        {
          title: 'Check your next reservation',
          description: 'Confirm the nearest scheduled session before planning anything else.'
        },
        {
          title: 'Review one recent report',
          description: 'Use the most recent feedback as your next-step guide.'
        }
      ],
      composerTitle: 'Create your next session',
      composerDescription:
        'Choose the next call format quickly, then move into speaking without extra decision-making.',
      historyTitle: 'Recent sessions',
      historyDescription:
        'Keep the session list for follow-up: what is live, what is scheduled, and what already has a report ready.',
      liveTitle: 'Live call',
      liveDescription:
        'Keep the focus on connection status, transcript, and a clean end-call action.',
      detailTitle: 'Session detail',
      detailDescription:
        'Use this panel for transcripts and reports without crowding the main action area.'
    },
    billing: {
      eyebrow: 'Plans and billing',
      title: 'Compare plans here. Payment is disabled for the portfolio demo.',
      description:
        'Toss and Apps in Toss billing code is implemented, but paid checkout is intentionally gated while business registration and provider review are pending.',
      trustPoints: [
        'Supabase anonymous demo auth active',
        'Plan and subscription surfaces visible',
        'Toss payment launch parked for review'
      ],
      currentPlanTitle: 'Your current access',
      currentPlanDescription:
        'Review what is active now here. Paid plan changes are not started in the public portfolio demo.',
      plansTitle: 'Plans for portfolio review',
      plansDescription:
        'Use this screen to inspect product packaging. Checkout buttons show the deferred-payment state instead of opening Toss.',
      planActionLabel: 'Payment deferred',
      planActionWebNote: 'Paid upgrades are disabled in this portfolio demo while Toss review and business registration are pending.',
      planActionUnavailableNote: 'Payment launch is disabled in this portfolio demo while Toss review and business registration are pending.',
      paymentDeferredNotice: 'Paid upgrades are disabled in this portfolio demo while Toss review and business registration are pending.',
      launchFailedNotice: 'Payment launch is currently disabled for portfolio use.',
      appsInTossReadyNotice: 'Apps in Toss billing code is present, but payment launch is disabled for this portfolio demo.',
      hostUnavailableNotice: 'Payment launch is disabled for this portfolio demo.',
      legacyReturnNotice: 'This older web billing return link is no longer used. No payment confirmation runs in the portfolio demo.',
      legacyReturnSuccessNotice: 'This older web success return opened correctly, but no payment confirmation runs in the portfolio demo.',
      legacyReturnCancelNotice: 'This older web cancel return opened correctly. The subscription is unchanged.'
    },
    report: {
      eyebrow: 'Practice report',
      title: 'Turn one short session into a clear next speaking target.',
      description:
        'Reports should feel like coaching, not paperwork. Read the summary first, then use the details when you need them.',
      summaryTitle: 'What to focus on next',
      scoreTitle: 'Score snapshot',
      correctionsTitle: 'Corrections worth noticing',
      fluencyTitle: 'Speaking rhythm'
    }
  },
  ko: {
    common: {
      privacy: '개인정보처리방침',
      terms: '이용약관',
      quickPractice: '짧고 가볍게 꾸준히 연습'
    },
    login: {
      eyebrow: '부담 없이 시작하는 AI 회화 연습',
      title: '긴 공부 대신, 일상에 들어오는 짧은 회화 연습부터 시작하세요.',
      description:
        'LinguaCall은 빠른 시작, 짧은 세션, 간단한 피드백으로 말하기 연습을 꾸준히 이어가도록 돕습니다.',
      bullets: [
        '긴 학습 블록 대신 짧은 통화 세션으로 시작합니다.',
        'SMS나 결제 없이 데모 세션으로 바로 체험할 수 있습니다.',
        '유료 플랜은 제품 맥락을 보여주기 위해 노출하지만, 포트폴리오 데모에서는 결제를 비활성화했습니다.'
      ],
      primaryCta: '데모로 바로 체험하기',
      primaryCtaLoading: '데모 접속 준비 중...',
      secondaryCta: '플랜 비교해보기',
      secondaryCtaAppsInToss: 'Apps in Toss에서 플랜 비교하기',
      valueTitle: '신뢰감을 먼저 만드는 이유',
      valueSummary:
        '처음 단계는 작아야 합니다. 데모 세션, 짧은 통화, 다음 행동 하나만 명확하면 됩니다.'
    },
    verify: {
      eyebrow: '빠른 본인 확인',
      title: '전화번호만 확인하면 바로 연습을 시작할 수 있습니다.',
      description:
        '처음 한 번만 인증하면 됩니다. 이후에는 이 기기에서 세션을 유지해 매번 OTP를 요구하지 않습니다.',
      stepsTitle: '인증 후 바로 가능한 것',
      steps: [
        '전화번호를 입력하고 인증 코드를 받습니다.',
        '코드를 확인하면 안전한 로그인 세션이 만들어집니다.',
        '바로 짧은 통화를 시작하거나 나중에 플랜을 확인할 수 있습니다. 포트폴리오 데모에서는 유료 결제를 진행하지 않습니다.'
      ],
      supportTitle: '복잡한 가입 흐름을 만들지 않습니다',
      supportCopy:
        '중요한 건 빨리 말하기 연습을 시작하는 것입니다. 결제 코드는 준비되어 있지만 포트폴리오용으로 실제 결제는 보류했습니다.'
    },
    session: {
      eyebrow: '연습 허브',
      title: '지금 해야 할 다음 말하기 행동이 가장 먼저 보이도록 정리했습니다.',
      description:
        '진행 중 통화로 돌아가거나, 가장 가까운 예약을 확인하거나, 지금 바로 짧은 세션을 시작하는 흐름에 먼저 집중합니다.',
      spotlightLiveTitle: '지금 진행 중인 통화',
      spotlightLiveDescription: '다른 탐색보다 먼저 현재 통화로 돌아가는 것이 좋습니다.',
      spotlightScheduledTitle: '가장 먼저 확인할 다음 예약',
      spotlightScheduledPrefix: '가장 가까운 예약 세션은 다음 시간으로 잡혀 있습니다:',
      spotlightEmptyTitle: '급하게 확인할 항목은 없습니다',
      spotlightEmptyDescription: '지금 바로 짧은 세션을 시작하거나, 예약 시간 하나만 정해 두면 됩니다.',
      constraintTenMinuteOnly: '현재 이용 상태에서는 가장 짧은 데모 세션부터 시작할 수 있습니다.',
      constraintTenOrFifteen: '현재 플랜에서는 여러 데모 세션 길이를 선택할 수 있습니다.',
      quickActionsTitle: '가장 먼저 할 행동부터',
      quickActions: [
        {
          title: '짧은 세션 바로 시작',
          description: '몇 번의 선택만으로 새 통화를 만들고 바로 말하기를 시작합니다.'
        },
        {
          title: '다음 예약 확인',
          description: '가장 가까운 예약 세션부터 확인하고 다음 움직임을 정합니다.'
        },
        {
          title: '최근 리포트 다시 보기',
          description: '가장 최근 피드백을 다음 통화의 기준점으로 삼습니다.'
        }
      ],
      composerTitle: '다음 세션 만들기',
      composerDescription:
        '통화 방식을 빠르게 정하고 바로 다음 말하기 행동으로 이어가면 됩니다.',
      historyTitle: '최근 세션',
      historyDescription:
        '세션 목록은 후속 확인용으로 둡니다. 진행 중, 예약됨, 리포트 준비 완료 상태를 한눈에 확인할 수 있습니다.',
      liveTitle: '진행 중 통화',
      liveDescription:
        '통화 중에는 연결 상태와 transcript, 종료 동작만 또렷하게 보이도록 정리합니다.',
      detailTitle: '세션 상세',
      detailDescription:
        '리포트와 transcript는 별도 패널로 분리해 메인 행동 영역이 복잡해지지 않게 합니다.'
    },
    billing: {
      eyebrow: '플랜과 결제',
      title: '여기서 플랜을 비교합니다. 포트폴리오 데모에서는 결제를 비활성화했습니다.',
      description:
        'Toss와 Apps in Toss 결제 코드는 구현되어 있지만, 사업자등록과 심사가 끝날 때까지 유료 결제 진입은 의도적으로 막아두었습니다.',
      trustPoints: [
        'Supabase 익명 데모 인증 활성화',
        '플랜과 구독 화면 확인 가능',
        'Toss 결제 진입은 심사 전 보류'
      ],
      currentPlanTitle: '현재 이용 상태',
      currentPlanDescription:
        '여기서 현재 플랜을 확인합니다. 공개 포트폴리오 데모에서는 유료 플랜 변경을 시작하지 않습니다.',
      plansTitle: '포트폴리오 검토용 플랜',
      plansDescription:
        '제품 패키징을 확인하기 위한 화면입니다. 결제 버튼은 Toss를 열지 않고 결제 보류 상태를 안내합니다.',
      planActionLabel: '결제 보류',
      planActionWebNote: 'Toss 심사와 사업자등록이 끝날 때까지 포트폴리오 데모에서는 유료 결제를 비활성화했습니다.',
      planActionUnavailableNote: 'Toss 심사와 사업자등록이 끝날 때까지 포트폴리오 데모에서는 결제 진입을 막아두었습니다.',
      paymentDeferredNotice: 'Toss 심사와 사업자등록이 끝날 때까지 포트폴리오 데모에서는 유료 결제를 비활성화했습니다.',
      launchFailedNotice: '포트폴리오 데모에서는 결제 진입을 열지 않습니다.',
      appsInTossReadyNotice: 'Apps in Toss 결제 코드는 준비되어 있지만, 이 포트폴리오 데모에서는 결제 진입을 막아두었습니다.',
      hostUnavailableNotice: '포트폴리오 데모에서는 결제 진입을 열지 않습니다.',
      legacyReturnNotice: '이전 웹 결제 복귀 링크가 열렸지만, 포트폴리오 데모에서는 결제 확인을 실행하지 않습니다.',
      legacyReturnSuccessNotice: '이전 웹 성공 복귀 링크가 열렸지만, 포트폴리오 데모에서는 결제 확인을 실행하지 않습니다.',
      legacyReturnCancelNotice: '이전 웹 취소 복귀 경로가 열렸습니다. 구독 상태는 변경되지 않았습니다.'
    },
    report: {
      eyebrow: '연습 리포트',
      title: '짧은 세션 하나를 다음 말하기 목표로 연결합니다.',
      description:
        '리포트는 서류처럼 느껴지면 안 됩니다. 먼저 요약을 보고, 필요할 때만 세부 항목을 펼쳐보면 됩니다.',
      summaryTitle: '다음에 집중할 한 가지',
      scoreTitle: '점수 요약',
      correctionsTitle: '바로 눈에 들어와야 하는 교정',
      fluencyTitle: '말하기 리듬'
    }
  }
} as const;

export function getFriendlyCopy(locale: string) {
  return locale.startsWith('ko') ? COPY.ko : COPY.en;
}

export function getPlanPresentation(locale: string, planCode: string) {
  const isKo = locale.startsWith('ko');
  const map = {
    free: isKo
      ? {
          label: '가볍게 체험',
          audience: '처음 한두 번 짧게 말해보고 싶은 사람',
          highlights: ['체험 통화', '짧은 첫 연습', '부담 없는 시작']
        }
      : {
          label: 'Try it lightly',
          audience: 'For people who want a few short calls before paying',
          highlights: ['Trial calls', 'Short first practice', 'Low-pressure start']
        },
    basic: isKo
      ? {
          label: '꾸준한 짧은 연습',
          audience: '짧게라도 자주 말하고 싶은 사람',
          highlights: ['짧은 통화 습관', '월 포함 분수', '가장 무난한 선택']
        }
      : {
          label: 'Steady short practice',
          audience: 'For people who want a light, repeatable speaking habit',
          highlights: ['Short-call habit', 'Monthly minutes', 'Balanced default choice']
        },
    pro: isKo
      ? {
          label: '더 자주, 더 구조적으로',
          audience: '예약과 리포트를 더 적극적으로 활용하고 싶은 사람',
          highlights: ['더 많은 분수', '리포트 활용', '예약 중심 루틴']
        }
      : {
          label: 'More structure, more repetition',
          audience: 'For people who want more minutes and stronger report usage',
          highlights: ['More minutes', 'Report habit', 'Reservation-friendly routine']
        }
  } as const;

  return map[planCode as keyof typeof map] ?? (isKo
    ? {
        label: '지속 가능한 연습',
        audience: '말하기 연습을 매달 이어가고 싶은 사람',
        highlights: ['월 구독', '짧은 통화', '꾸준한 사용']
      }
    : {
        label: 'Sustainable practice',
        audience: 'For people building a monthly speaking habit',
        highlights: ['Monthly plan', 'Short calls', 'Repeatable use']
      });
}

export function getLanguageDisplayName(code: string) {
  const names: Record<string, string> = {
    en: 'English / OPIC',
    de: 'Deutsch / Goethe B2',
    zh: 'Chinese / HSK 5',
    es: 'Espanol / DELE B1',
    ja: 'Japanese / JLPT N2',
    fr: 'Francais / DELF B1'
  };

  return names[code] ?? code.toUpperCase();
}
