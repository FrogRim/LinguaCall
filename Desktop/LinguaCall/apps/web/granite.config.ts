import { defineConfig } from '@apps-in-toss/web-framework/config';

/**
 * appName MUST match the mini-app id registered in the Apps in Toss console.
 * 출시 검수 전 반드시 콘솔 값과 문자열 일치 여부를 확인합니다.
 *
 * realtime 음성(WebRTC)·마이크 사용 시 앱인토스 콘솔 및 비게임 출시 체크리스트의
 * 권한·민감 기능(녹음/마이크) 공지 요건을 채워야 합니다. Granite `permissions`
 * 타입은 토스 문서 버전을 따릅니다—필요 시 공식 레퍼런스와 동일한 키로 추가합니다.
 */
export default defineConfig({
  appName: 'lingua-call',
  brand: {
    displayName: 'LinguaCall',
    primaryColor: '#3182F6',
    icon: '/icon.png',
  },
  web: {
    host: 'localhost',
    port: 5173,
    commands: {
      dev: 'vite',
      build: 'vite build',
    },
  },
  navigationBar: {
    withBackButton: true,
  },
  permissions: [
    { name: 'microphone', access: 'access' },
  ],
});
