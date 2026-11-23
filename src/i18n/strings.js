// Minimal translations for the title menu and the 2-minute guided path.
import { useStore } from '../state/store.js';

const STRINGS = {
  en: {
    start: 'START', settings: 'SETTINGS', detail: 'DETAIL', language: 'Language', credits: 'Credits',
    subtitle: 'Why your phone needs a 4th satellite',
    headline: 'Your phone needs a 4th satellite because it doesn’t know the exact time.',
    loading: 'LOADING',
    coach1: 'This green pin is your phone. Drag it anywhere on Earth (or press “Drop pin”).',
    coach2: 'Three satellites time their signals to you. But your phone’s clock is 1 ms off, so every distance is 300 km too long. The circles no longer meet, and the orange 3-satellite fix lands far away. Look how deep underground it thinks you are!',
    coach3: 'Now drag the 4th satellite from the sidebar into the sky, away from the others.',
    coach4: 'The blue 4-satellite fix snapped onto your phone: it solved for the clock error too. Now slide the clock error: orange runs away, blue stays put.',
    coachDone: 'That’s why GPS needs four satellites: three for where, one more for when. Explore further: street-level zoom, geometry (DOP) and errors in “Go deeper”.',
    next: 'Next', skip: 'Skip tour', done: 'Explore!', back: 'Back',
  },
  ko: {
    start: '시작', settings: '설정', detail: '자세히', language: '언어', credits: '만든 사람',
    subtitle: '왜 휴대폰은 네 번째 위성이 필요할까?',
    headline: '휴대폰은 정확한 시간을 모르기 때문에 네 번째 위성이 필요합니다.',
    loading: '로딩 중',
    coach1: '초록색 핀이 당신의 휴대폰입니다. 지구 어디로든 끌어 보세요 (또는 “핀 놓기”).',
    coach2: '위성 세 개가 신호 도착 시간으로 거리를 잽니다. 그런데 휴대폰 시계가 1 ms 틀려서 모든 거리가 300 km씩 길어졌어요. 원들이 한 점에서 만나지 않고, 주황색 3-위성 위치는 멀리 (심지어 땅속 깊이!) 떨어집니다.',
    coach3: '이제 사이드바에서 네 번째 위성을 다른 위성들과 떨어진 하늘로 끌어 놓으세요.',
    coach4: '파란색 4-위성 위치가 휴대폰에 딱 붙었습니다. 시계 오차까지 함께 풀었기 때문이에요. 이제 시계 오차 슬라이더를 움직여 보세요: 주황색은 도망가고 파란색은 그대로입니다.',
    coachDone: '그래서 GPS는 위성 네 개가 필요합니다: 셋은 “어디”를, 하나는 “언제”를 위해. 더 알아보기: 거리 지도 확대, 위성 배치(DOP), 오차는 “더 깊이”에서.',
    next: '다음', skip: '건너뛰기', done: '탐험하기!', back: '뒤로',
  },
};

export function useT() {
  const lang = useStore((s) => s.settings.lang);
  return (key) => STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
}
