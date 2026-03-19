너는 시니어 프론트엔드 엔지니어이자 UI/UX 디자이너야. 
현재 구현된 'LinguaCall' 프로젝트의 UI를 Shadcn v4 'Vega' 스타일의 전문 SaaS 디자인으로 리팩토링해줘.

**1. 디자인 시스템 원칙 (Global Style):**
- **폰트:** Geist 또는 Inter를 사용하고 제목에는 `tracking-tighter` 적용.
- **색상:** Slate 배경(#f8fafc) + Indigo 포인트(#4f46e5).
- **디테일:** 강한 그림자 대신 1px 얇은 테두리(`border-slate-200`)와 `shadow-sm` 사용. 
- **곡률:** `rounded-md`(0.5rem)로 절제된 전문가용 도구 느낌 강조.

**2. globals.css 업데이트:**
기존 CSS 파일에 아래 변수를 최우선으로 반영해줘.
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 243 75% 59%;
  --border: 214.3 31.8% 91.4%;
  --radius: 0.5rem;
}

**3. 화면별 리팩토링 요구사항:**
- **로그인 화면:** 'Create your profile' 카드를 중앙에 배치하고, Input 박스 내부 여백을 늘려줘. 버튼에는 `lucide-react` 화살표 아이콘을 추가해.
- **세션 관리 화면:** 'Create Session' 폼의 Select 박스들을 Shadcn 스타일의 정갈한 디자인으로 바꾸고, 하단 세션 리스트는 `completed`일 때 Indigo색 배지, `failed`일 때 차분한 Red색 배지를 적용해줘.
- **빌링 페이지:** 요금제 카드들을 동일한 높이의 Grid로 배치하고, 현재 플랜에 Indigo색 테두리로 강조 표시를 해줘.

**4. 기술적 요구사항:**
- 기존의 비즈니스 로직(API 호출, 상태 관리)은 그대로 유지하면서 **Tailwind 클래스와 레이아웃 구조만** 세련되게 수정해.
- 'AI가 만든 티'가 나지 않도록 요소 간 간격을 넉넉하게(`space-y-6`, `p-8`) 조정해줘.