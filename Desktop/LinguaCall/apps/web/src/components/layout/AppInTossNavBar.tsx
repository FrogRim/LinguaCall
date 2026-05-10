import { useNavigate, useLocation } from 'react-router-dom';
import { closeView } from '@apps-in-toss/web-framework';
import { TextButton } from '@toss/tds-mobile';

export function AppInTossNavBar({ title = 'LinguaCall' }: { title?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const canGoBack = location.key !== 'default';

  const handleBack = () => {
    if (canGoBack) navigate(-1);
  };

  const handleClose = () => {
    void closeView();
  };

  return (
    <div className="flex h-11 shrink-0 items-center justify-between border-b border-border bg-background px-2">
      <button
        type="button"
        onClick={handleBack}
        disabled={!canGoBack}
        aria-label="뒤로가기"
        className="flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary disabled:opacity-30"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <span className="text-sm font-semibold text-foreground">{title}</span>

      <TextButton size="xsmall" onClick={handleClose} aria-label="닫기">
        닫기
      </TextButton>
    </div>
  );
}
