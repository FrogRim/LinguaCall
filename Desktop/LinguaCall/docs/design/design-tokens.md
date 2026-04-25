# LinguCall design-tokens.md

## 목적

이 문서는 LinguCall의 시각 토큰과 구현 토큰 정의 문서다.
`DESIGN.md`가 상위 원칙이라면, 이 문서는 실제 프론트엔드에서 CSS 변수, Tailwind theme, component props로 옮길 수 있는 기준값을 제공한다.

Codex는 시각 구현 시 다음 우선순위를 따른다.

1. root `DESIGN.md`
2. 이 문서의 semantic token
3. 페이지별 예외 규칙

---

## 1. Token Strategy

토큰은 raw color보다 semantic token 중심으로 사용한다.

예:
- `--bg-primary`
- `--surface-secondary`
- `--text-muted`
- `--accent-brand`
- `--border-subtle`

직접 hex를 컴포넌트에 박아 넣지 않는다.

---

## 2. Color Tokens

### 2.1 Base Surface Tokens

```css
--bg-primary: #fcfcfb;
--bg-secondary: #f6f6f4;
--surface-primary: #ffffff;
--surface-secondary: #f8f7f5;
--surface-muted: #f2f1ee;
--surface-elevated: #ffffff;
```

### 2.2 Border Tokens

```css
--border-subtle: #e6e4df;
--border-default: #ddd9d2;
--border-strong: #cfc9bf;
```

### 2.3 Text Tokens

```css
--text-primary: #161616;
--text-secondary: #5d5b56;
--text-tertiary: #87837b;
--text-disabled: #aaa59c;
--text-on-accent: #ffffff;
```

### 2.4 Brand Tokens

```css
--accent-brand: #2f5bea;
--accent-brand-hover: #264cd0;
--accent-brand-soft: #eef2ff;
--accent-brand-soft-text: #2948b8;
```

### 2.5 Feedback Tokens

```css
--success: #2f7a4f;
--success-soft: #eef8f1;
--warning: #b7791f;
--warning-soft: #fff7e8;
--danger: #c24141;
--danger-soft: #fff1f1;
--info: #365ec9;
--info-soft: #eef3ff;
```

### 2.6 Voice Layer Tokens

```css
--voice-surface: #fbf8f4;
--voice-glow: rgba(82, 110, 204, 0.08);
--voice-accent: #5d74d6;
--voice-wave-muted: #d6dcef;
```

### 2.7 Report Layer Tokens

```css
--report-paper: #fffdfa;
--report-section: #faf8f4;
--report-highlight: #f3efe7;
```

### 2.8 Billing Layer Tokens

```css
--billing-surface: #ffffff;
--billing-accent: #635bff;
--billing-accent-soft: #f1f0ff;
--billing-text-strong: #111827;
```

---

## 3. Typography Tokens

## 3.1 Font Families

```css
--font-sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
--font-display: Inter, ui-sans-serif, system-ui, sans-serif;
--font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
```

현재는 single-family 전략을 우선한다.
MVP에서는 과한 font 조합보다 일관성이 중요하다.

## 3.2 Font Sizes

```css
--text-xs: 12px;
--text-sm: 14px;
--text-base: 16px;
--text-lg: 18px;
--text-xl: 20px;
--text-2xl: 24px;
--text-3xl: 30px;
--text-4xl: 36px;
```

## 3.3 Line Heights

```css
--leading-tight: 1.2;
--leading-snug: 1.35;
--leading-normal: 1.5;
--leading-relaxed: 1.65;
```

## 3.4 Font Weights

```css
--weight-regular: 400;
--weight-medium: 500;
--weight-semibold: 600;
--weight-bold: 700;
```

## 3.5 Type Usage Rules

- Body 기본값은 `16px`, `line-height 1.5`
- report text는 `16px` 또는 `18px`, `line-height 1.65`
- metadata는 `14px` 이하로 떨어져도 되지만, 모바일에서 지나치게 작아지면 안 됨
- timer는 `24px` 이상 권장

---

## 4. Spacing Tokens

### 4.1 Base Scale

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
```

### 4.2 Layout Rules

- section 간격은 최소 `32px`
- card 내부 기본 padding은 `16px` 또는 `20px`
- report section은 `24px` 이상 간격 유지
- CTA 주변은 일반 요소보다 더 넓은 breathing space 유지

---

## 5. Radius Tokens

```css
--radius-sm: 8px;
--radius-md: 12px;
--radius-lg: 16px;
--radius-xl: 20px;
--radius-pill: 999px;
```

규칙:
- 전역 기본은 `12px`
- 큰 summary card는 `16px`
- pill chip, segmented control은 `999px`
- bubble-like 과도한 rounding 금지

---

## 6. Shadow Tokens

```css
--shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.04);
--shadow-md: 0 8px 24px rgba(15, 23, 42, 0.06);
--shadow-lg: 0 18px 40px rgba(15, 23, 42, 0.08);
```

규칙:
- 대부분의 구분은 border로 해결
- elevated hero, modal, pricing 추천 카드 정도에서만 shadow 사용
- in-call 화면의 glow는 shadow가 아니라 background effect로 처리

---

## 7. Motion Tokens

```css
--duration-fast: 120ms;
--duration-normal: 180ms;
--duration-slow: 260ms;
--ease-standard: cubic-bezier(0.2, 0.8, 0.2, 1);
```

규칙:
- hover는 `120~180ms`
- screen transition은 `180~260ms`
- bounce, elastic, dramatic spring 금지

---

## 8. Layout Tokens

### 8.1 Container Widths

```css
--container-sm: 640px;
--container-md: 768px;
--container-lg: 960px;
--container-xl: 1120px;
```

권장:
- onboarding, config, billing: `768~960px`
- report reading: `768px` 전후
- marketing section: `1120px`까지 허용

### 8.2 Grid Usage

- mobile 기본 1-column
- desktop 2-column은 필요한 곳만
- report main content는 지나치게 넓히지 않음

---

## 9. Component Tokens

## 9.1 Buttons

### Primary Button

```css
--button-primary-bg: var(--accent-brand);
--button-primary-bg-hover: var(--accent-brand-hover);
--button-primary-text: var(--text-on-accent);
--button-primary-radius: var(--radius-md);
--button-primary-height: 44px;
```

### Secondary Button

```css
--button-secondary-bg: var(--surface-primary);
--button-secondary-border: var(--border-default);
--button-secondary-text: var(--text-primary);
```

### Destructive Button

```css
--button-danger-bg: var(--danger-soft);
--button-danger-text: var(--danger);
--button-danger-border: #f2caca;
```

## 9.2 Cards

```css
--card-bg: var(--surface-primary);
--card-border: var(--border-subtle);
--card-radius: var(--radius-lg);
--card-padding: var(--space-5);
```

Card variants:
- summary
- report
- scheduled
- correction
- billing
- status

## 9.3 Inputs

```css
--input-height: 44px;
--input-bg: var(--surface-primary);
--input-border: var(--border-default);
--input-border-focus: var(--accent-brand);
--input-radius: var(--radius-md);
```

## 9.4 Chips

```css
--chip-bg: var(--surface-muted);
--chip-text: var(--text-secondary);
--chip-radius: var(--radius-pill);
--chip-padding-x: 10px;
--chip-padding-y: 6px;
```

## 9.5 Segmented Controls

```css
--segment-bg: var(--surface-muted);
--segment-active-bg: var(--surface-primary);
--segment-active-border: var(--border-default);
--segment-radius: var(--radius-pill);
```

---

## 10. State Tokens

### 10.1 Session State Visual Mapping

- `ready`: neutral / actionable
- `scheduled`: info-soft
- `dialing`: brand-soft
- `ringing`: brand-soft
- `in_progress`: voice-layer accent + subtle pulse
- `report_pending`: warning-soft
- `report_ready`: success-soft
- terminal failure: danger-soft or muted warning, depending on severity

### 10.2 Call Status Treatment

- `dialing`, `ringing`는 공포감을 주지 않게 calm status 사용
- `in_progress`는 active indicator 허용
- `ending`은 low-motion fade state

---

## 11. Phase-Specific Token Notes

### Phase 1

- chart tokens 사용 최소화
- home page는 analytics-heavy token 사용 금지
- report와 session flow에만 집중

### Phase 2a

- chart color tokens 추가 가능
- billing tokens 적극 사용 가능

### Phase 2b

- recurring schedule tokens 추가
- multilingual language chip style 추가 가능

---

## 12. Suggested Tailwind Mapping

예시 매핑:

- `background` -> `bg-[var(--bg-primary)]`
- `card` -> `bg-[var(--surface-primary)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)]`
- `text-primary` -> `text-[var(--text-primary)]`
- `text-secondary` -> `text-[var(--text-secondary)]`
- `brand` -> `bg-[var(--accent-brand)] text-[var(--text-on-accent)]`

Tailwind theme 확장 시 semantic token alias를 우선한다.
raw color naming은 최소화한다.

---

## 13. Final Rules

- 토큰은 semantic naming을 우선한다.
- phase별로 style layer는 바뀔 수 있어도 base tokens는 흔들지 않는다.
- voice layer, report layer, billing layer는 모두 global shell 위에 얹히는 변형이어야 한다.
- 한 페이지 안에서 서로 다른 layer를 과하게 섞지 않는다.
- 디자인 시스템은 일관성이 우선이다.
