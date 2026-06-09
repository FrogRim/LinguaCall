import { useTranslation } from 'react-i18next';
import { StaticDocumentPage } from '../components/layout/StaticDocumentPage';

export default function ScreenTerms() {
  const { i18n } = useTranslation();
  const isKo = i18n.language.startsWith('ko');

  return (
    <StaticDocumentPage
      eyebrow={isKo ? '서비스 이용 안내' : 'Service terms'}
      title={isKo ? '이용약관' : 'Terms of Service'}
      updatedAt="2026-06-09"
      locale={i18n.language}
    >
      <section className="space-y-3">
        <p>
          {isKo
            ? '이 약관은 LinguaCall 서비스 이용과 관련한 기본 조건을 설명합니다. 사용자는 계정 생성 및 서비스 이용을 시작함으로써 본 약관에 동의한 것으로 봅니다.'
            : 'These terms explain the baseline rules for using LinguaCall. By creating an account and using the service, you agree to these terms.'}
        </p>
      </section>

      <section className="space-y-3">
        <h2>{isKo ? '1. 서비스 성격' : '1. Nature of the service'}</h2>
        <p>
          {isKo
            ? 'LinguaCall은 AI 기반 실시간 회화 연습 및 리포트 제공 서비스입니다. 시험 대비 또는 일상 회화 연습을 보조하기 위한 도구이며, 자격을 보장하거나 공식 교육기관을 대체하지 않습니다.'
            : 'LinguaCall is an AI-powered realtime speaking practice and reporting service. It supports language practice and exam preparation, but it does not guarantee outcomes or replace formal instruction.'}
        </p>
      </section>

      <section className="space-y-3">
        <h2>{isKo ? '2. 계정 및 인증' : '2. Accounts and verification'}</h2>
        <ul>
          <li>{isKo ? '공개 포트폴리오 데모는 Supabase 익명 데모 로그인을 사용합니다.' : 'The public portfolio demo uses Supabase anonymous demo login.'}</li>
          <li>{isKo ? '전화번호 OTP 인증 코드는 보존되어 있지만 현재 공개 데모에서는 노출하지 않습니다.' : 'Phone OTP verification code is preserved, but it is not exposed in the current public demo.'}</li>
          <li>{isKo ? '세션 보안을 위해 서비스는 일정 조건에서 재로그인을 요청할 수 있습니다.' : 'The service may require re-login in certain security scenarios.'}</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2>{isKo ? '3. 결제 및 구독' : '3. Billing and subscriptions'}</h2>
        <ul>
          <li>{isKo ? '유료 플랜 결제는 포트폴리오 데모에서 비활성화되어 있습니다.' : 'Paid plan checkout is disabled in the portfolio demo.'}</li>
          <li>{isKo ? 'Toss Payments 연동은 구현되어 있으며, 사업자등록과 심사 완료 후 운영 결제로 전환할 수 있습니다.' : 'The Toss Payments integration is implemented and can be enabled after business registration and provider review.'}</li>
          <li>{isKo ? '플랜별 제공 분수와 최대 세션 시간은 안내된 정책을 따릅니다.' : 'Included minutes and max session length follow the published plan rules.'}</li>
          <li>{isKo ? '결제 기능을 활성화하기 전까지는 결제 또는 자동 과금이 발생하지 않습니다.' : 'No payment or automatic charge is created before billing is explicitly enabled.'}</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2>{isKo ? '4. 사용 제한' : '4. Acceptable use'}</h2>
        <ul>
          <li>{isKo ? '서비스를 불법적이거나 유해한 목적으로 사용하면 안 됩니다.' : 'Do not use the service for illegal or harmful purposes.'}</li>
          <li>{isKo ? '자동화된 대량 요청이나 시스템 악용 시도가 감지되면 접근이 제한될 수 있습니다.' : 'Access may be restricted if automated abuse or misuse is detected.'}</li>
          <li>{isKo ? '서비스 안정성을 해치는 방식의 사용은 제한 대상입니다.' : 'Usage that threatens service stability may be blocked.'}</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2>{isKo ? '5. 면책 및 책임 제한' : '5. Disclaimer and limitation of liability'}</h2>
        <p>
          {isKo
            ? '서비스는 가능한 범위에서 안정적으로 제공되지만, 네트워크 상태나 외부 서비스 장애로 인해 일부 기능이 일시적으로 제한될 수 있습니다. 회사는 고의 또는 중대한 과실이 없는 한 간접 손해에 대해 책임을 지지 않습니다.'
            : 'The service is provided on a best-effort basis. Some features may be temporarily limited due to network conditions or third-party outages. To the extent permitted by law, indirect damages are excluded unless caused by willful misconduct or gross negligence.'}
        </p>
      </section>

      <section className="space-y-3">
        <h2>{isKo ? '6. 문의' : '6. Contact'}</h2>
        <p>
          {isKo
            ? '계정, 결제, 약관 관련 문의는 support@linguacall.shop 으로 접수합니다.'
            : 'Questions about accounts, billing, or these terms can be sent to support@linguacall.shop.'}
        </p>
      </section>
    </StaticDocumentPage>
  );
}
